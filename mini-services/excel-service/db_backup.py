"""
Automatic database backup utility with scheduled backups and cleanup.
Works without root privileges - backs up to user-accessible directories.
"""
import os
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from logger_config import get_logger

logger = get_logger("db_backup")

# Backup configuration
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", Path(__file__).parent / "backups" / "db"))
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# Keep last N backups
MAX_BACKUPS = int(os.environ.get("DB_BACKUP_MAX_KEEP", "10"))

# Database paths
DB_DIR = Path(os.environ.get("DB_DIR", Path(__file__).parent.parent / "db"))


def get_db_files() -> List[Path]:
    """Find all SQLite database files in the DB directory."""
    if not DB_DIR.exists():
        logger.warning(f"Database directory does not exist: {DB_DIR}")
        return []
    
    db_files = list(DB_DIR.glob("*.db"))
    logger.info(f"Found {len(db_files)} database files: {[f.name for f in db_files]}")
    return db_files


def backup_database(db_path: Path, backup_name: Optional[str] = None) -> Optional[Path]:
    """
    Create a backup of a SQLite database file.
    
    Args:
        db_path: Path to the database file
        backup_name: Optional custom name for backup (default: {db_name}_{timestamp}.db)
        
    Returns:
        Path to the backup file, or None if backup failed
    """
    if not db_path.exists():
        logger.error(f"Database file does not exist: {db_path}")
        return None
    
    try:
        # Generate backup filename
        if backup_name:
            backup_filename = backup_name
        else:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{db_path.stem}_{timestamp}.db"
        
        backup_path = BACKUP_DIR / backup_filename
        
        # Close any open connections first (important for SQLite)
        try:
            conn = sqlite3.connect(str(db_path))
            conn.close()
        except Exception as e:
            logger.warning(f"Could not close DB connection gracefully: {e}")
        
        # Copy the file
        shutil.copy2(db_path, backup_path)
        
        # Verify backup integrity
        if verify_backup(backup_path):
            size_mb = backup_path.stat().st_size / (1024 * 1024)
            logger.info(f"Backup created successfully: {backup_path.name} ({size_mb:.2f} MB)")
            return backup_path
        else:
            logger.error(f"Backup verification failed: {backup_path}")
            backup_path.unlink(missing_ok=True)
            return None
            
    except Exception as e:
        logger.error(f"Backup failed for {db_path}: {e}", exc_info=True)
        return None


def verify_backup(backup_path: Path) -> bool:
    """Verify that a backup file is a valid SQLite database."""
    if not backup_path.exists():
        return False
    
    try:
        conn = sqlite3.connect(str(backup_path))
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check")
        result = cursor.fetchone()
        conn.close()
        return result and result[0] == "ok"
    except Exception as e:
        logger.error(f"Backup verification error: {e}")
        return False


def cleanup_old_backups(max_keep: int = MAX_BACKUPS) -> int:
    """
    Remove old backups, keeping only the most recent ones.
    
    Args:
        max_keep: Maximum number of backups to keep per database
        
    Returns:
        Number of backups removed
    """
    removed_count = 0
    
    # Group backups by database name
    db_backups: dict[str, List[Path]] = {}
    for backup_file in BACKUP_DIR.glob("*.db"):
        # Extract base name (without timestamp)
        parts = backup_file.stem.rsplit("_", 2)  # Split from right, max 2 parts
        if len(parts) >= 2:
            base_name = "_".join(parts[:-2])  # Everything except last 2 parts (date_time)
        else:
            base_name = backup_file.stem
        
        if base_name not in db_backups:
            db_backups[base_name] = []
        db_backups[base_name].append(backup_file)
    
    # Sort and remove old backups for each database
    for base_name, backups in db_backups.items():
        # Sort by modification time (newest first)
        backups.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        
        # Remove old backups
        for old_backup in backups[max_keep:]:
            try:
                old_backup.unlink()
                logger.info(f"Removed old backup: {old_backup.name}")
                removed_count += 1
            except Exception as e:
                logger.error(f"Failed to remove old backup {old_backup}: {e}")
    
    return removed_count


def run_scheduled_backup() -> dict:
    """
    Run a scheduled backup of all databases.
    
    Returns:
        Dictionary with backup results
    """
    logger.info("Starting scheduled database backup")
    
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "backed_up": [],
        "failed": [],
        "cleaned_up": 0,
    }
    
    db_files = get_db_files()
    
    for db_path in db_files:
        backup_path = backup_database(db_path)
        if backup_path:
            results["backed_up"].append(str(backup_path))
        else:
            results["failed"].append(str(db_path))
    
    # Cleanup old backups
    results["cleaned_up"] = cleanup_old_backups()
    
    logger.info(
        f"Backup completed: {len(results['backed_up'])} succeeded, "
        f"{len(results['failed'])} failed, {results['cleaned_up']} old backups removed"
    )
    
    return results


def list_backups() -> List[dict]:
    """List all available backups with metadata."""
    backups = []
    for backup_file in sorted(BACKUP_DIR.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = backup_file.stat()
        backups.append({
            "filename": backup_file.name,
            "path": str(backup_file),
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "valid": verify_backup(backup_file),
        })
    return backups


def restore_from_backup(backup_path: Path, target_db: Optional[Path] = None) -> bool:
    """
    Restore a database from backup.
    
    Args:
        backup_path: Path to the backup file
        target_db: Optional target path (default: original location)
        
    Returns:
        True if restore was successful
    """
    if not backup_path.exists():
        logger.error(f"Backup file does not exist: {backup_path}")
        return False
    
    if not verify_backup(backup_path):
        logger.error(f"Backup file is corrupted: {backup_path}")
        return False
    
    # Determine target path
    if target_db is None:
        # Extract original name from backup name
        parts = backup_path.stem.rsplit("_", 2)
        if len(parts) >= 2:
            original_name = "_".join(parts[:-2]) + ".db"
        else:
            original_name = backup_path.stem + ".db"
        target_db = DB_DIR / original_name
    
    try:
        shutil.copy2(backup_path, target_db)
        logger.info(f"Database restored from {backup_path.name} to {target_db}")
        return True
    except Exception as e:
        logger.error(f"Restore failed: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    # Run backup when executed directly
    results = run_scheduled_backup()
    print(f"Backup results: {results}")
