'use client'

import { useExcelStore } from '@/store/excel-store'
import SpreadsheetGrid from '@/components/excel/SpreadsheetGrid'
import Toolbar from '@/components/excel/Toolbar'
import FormulaBar from '@/components/excel/FormulaBar'
import SheetTabs from '@/components/excel/SheetTabs'
import CellContextMenu from '@/components/excel/CellContextMenu'
import Sidebar from '@/components/excel/Sidebar'
import MacroEditor from '@/components/excel/MacroEditor'
import FindReplaceDialog from '@/components/excel/FindReplaceDialog'
import MainDatabasePanel from '@/components/excel/MainDatabasePanel'
import DataMergePanel from '@/components/excel/DataMergePanel'
import CalendarPanel from '@/components/excel/CalendarPanel'
import FilePreparePanel from '@/components/excel/FilePreparePanel'
import GelendzhikCareerPanel from '@/components/excel/GelendzhikCareerPanel'
import TicketCostsPanel from '@/components/excel/TicketCostsPanel'
import VbaLaboratoryPanel from '@/components/excel/VbaLaboratoryPanel'
import ModulePlaceholderPanel from '@/components/excel/ModulePlaceholderPanel'
import DailyAccountingPanel from '@/components/excel/DailyAccountingPanel'
import SettingsPanel from '@/components/settings/SettingsPanel'
import { Button } from '@/components/ui/button'
import { Table2, ArrowLeft } from 'lucide-react'
import AppLoginBar from '@/components/home/AppLoginBar'
import { StatusBar } from '@/components/home/StatusBar'
import { WelcomeScreen } from '@/components/home/WelcomeScreen'
import { ErrorNotification } from '@/components/home/ErrorNotification'
import { LoadingOverlay } from '@/components/home/LoadingOverlay'
import { getHomeModule } from '@/lib/home-modules'

export function MainInterface() {
  const activeFile = useExcelStore((s) => s.activeFile)
  const goBack = useExcelStore((s) => s.goBack)
  const canGoBack = useExcelStore((s) => s.navHistory.length > 0)
  const mod = getHomeModule(activeFile?.id)
  const panel = mod?.panel
  const isSettingsTab = activeFile?.id === 'settings'

  const headerBarClass = mod?.headerBarClass ?? 'from-green-700 to-green-800'
  const HeaderIcon = mod?.Icon ?? Table2
  const headerTitle =
    mod?.title
    ?? (activeFile ? `Таблица — ${activeFile.name}` : 'Отчетность ОМиК ВелесстройМонтаж')

  const renderModulePanel = () => {
    if (isSettingsTab) {
      return <SettingsPanel />
    }
    switch (panel) {
      case 'main-db':
        return <MainDatabasePanel />
      case 'data-merge':
        return <DataMergePanel />
      case 'calendar':
        return <CalendarPanel />
      case 'file-prepare':
        return <FilePreparePanel />
      case 'gelendzhik':
        return <GelendzhikCareerPanel />
      case 'ticket-costs':
        return <TicketCostsPanel />
      case 'vba-laboratory':
        return <VbaLaboratoryPanel />
      case 'daily-accounting':
        return <DailyAccountingPanel />
      case 'placeholder':
        return <ModulePlaceholderPanel />
      default:
        return null
    }
  }

  const showModuleShell = Boolean(activeFile && (panel || isSettingsTab))

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      <div className={`flex items-center h-8 text-white px-3 flex-shrink-0 shadow-sm bg-gradient-to-r ${headerBarClass}`}>
        <div className="flex items-center gap-2">
          <HeaderIcon className="h-4 w-4" />
          <span className="text-xs font-medium">{headerTitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeFile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] text-white/80 hover:text-white hover:bg-white/20 px-2"
              onClick={() => goBack()}
              title={canGoBack ? 'Предыдущий экран' : 'На главный экран'}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Назад
            </Button>
          )}
          <span className="text-[10px] text-white/60">v1.0</span>
        </div>
      </div>

      {showModuleShell ? (
        <>
          <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden">
            {renderModulePanel()}
          </div>
          <StatusBar />
        </>
      ) : activeFile ? (
        <>
          <Toolbar />
          <FormulaBar />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <SpreadsheetGrid />
          </div>
          <SheetTabs />
          <StatusBar />
        </>
      ) : (
        <>
          <div className="flex items-center min-h-10 border-b border-gray-200 bg-gray-50 px-3 flex-shrink-0">
            <AppLoginBar align="left" />
          </div>
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <WelcomeScreen />
          </div>
          <StatusBar />
        </>
      )}

      <CellContextMenu />
      <MacroEditor />
      <FindReplaceDialog />
      <ErrorNotification />
      <LoadingOverlay />
    </div>
  )
}
