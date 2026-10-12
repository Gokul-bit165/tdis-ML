/**
 * @fileoverview Mobile floating action button with slide-up sheet.
 * Used for mobile-friendly map controls on small screens.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionButton = motion.button;
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';

/**
 * MobileControlsFAB Component
 *
 * A floating action button that expands into a slide-up sheet on mobile.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the sheet is open
 * @param {Function} props.onOpenChange - Callback when open state changes
 * @param {React.ElementType} props.fabIcon - Icon component for the FAB
 * @param {string} props.fabLabel - Label text for the FAB
 * @param {string} props.sheetTitle - Title for the sheet header
 * @param {React.ElementType} props.sheetIcon - Icon component for the sheet header
 * @param {string} props.sheetIconColor - Color for the sheet header icon
 * @param {string} props.sheetHeight - Height of the sheet (default: '70vh')
 * @param {React.ReactNode} props.children - Sheet content
 * @param {React.ReactNode} props.tabNavigation - Optional tab navigation component for the sheet
 */
const MobileControlsFAB = ({
  isOpen = false,
  onOpenChange,
  fabIcon: FabIcon,
  fabLabel = 'Controls',
  sheetTitle,
  sheetIcon: SheetIcon,
  sheetIconColor = '#324755',
  sheetHeight = '70vh',
  children,
  tabNavigation,
}) => {
  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!isOpen && (
          <MotionButton
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onOpenChange(true)}
            className="absolute bottom-28 right-3 z-20 flex items-center gap-2 px-4 py-3 bg-[#324755] text-white rounded-full shadow-lg hover:bg-[#3d5566] transition-colors"
            style={{ boxShadow: '0 4px 20px rgba(50, 71, 85, 0.35)' }}
          >
            {FabIcon && <FabIcon className="w-5 h-5" />}
            <span className="text-sm font-semibold">{fabLabel}</span>
          </MotionButton>
        )}
      </AnimatePresence>

      {/* Sheet */}
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={`h-[${sheetHeight}] rounded-t-2xl p-0 flex flex-col`}
        >
          {/* Sheet Header */}
          <SheetHeader className="p-4 pb-2 flex-row items-center justify-between border-b border-gray-200">
            <SheetTitle className="flex items-center gap-2 text-[#324755]">
              {SheetIcon && <SheetIcon className="w-5 h-5" style={{ color: sheetIconColor }} />}
              {sheetTitle}
            </SheetTitle>
            <SheetClose asChild>
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </SheetClose>
          </SheetHeader>

          {/* Optional Tab Navigation */}
          {tabNavigation}

          {/* Sheet Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileControlsFAB;
