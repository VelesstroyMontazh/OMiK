"""
Logging configuration with rotation for Excel Service.
Provides rotating file handlers to prevent log files from growing indefinitely.
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Log directory
LOG_DIR = Path(os.environ.get("LOG_DIR", Path(__file__).parent / "logs"))
LOG_DIR.mkdir(exist_ok=True)

# Log file settings
LOG_FILE = LOG_DIR / "excel_service.log"
MAX_BYTES = 10 * 1024 * 1024  # 10 MB
BACKUP_COUNT = 5  # Keep 5 backup files

# Console log level
CONSOLE_LOG_LEVEL = logging.INFO
# File log level
FILE_LOG_LEVEL = logging.DEBUG


def setup_logger(name: str = "excel_service") -> logging.Logger:
    """
    Set up a logger with rotating file handler and console handler.
    
    Args:
        name: Logger name
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.DEBUG)
    
    # Create formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(CONSOLE_LOG_LEVEL)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Rotating file handler
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding="utf-8"
    )
    file_handler.setLevel(FILE_LOG_LEVEL)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str = "excel_service") -> logging.Logger:
    """Get or create a logger with the specified name."""
    return setup_logger(name)


# Default logger instance
logger = get_logger()
