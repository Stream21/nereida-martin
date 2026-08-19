import Icon from '../ui/Icon'
import BookingDetailContent from './BookingDetailContent'

export default function BookingDetailModal({ bookingId, preview, initialView, onClose, onUpdated }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-surface/35 backdrop-blur-[2px] p-0 sm:p-4">
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest shadow-[0_20px_50px_rgba(67,61,60,0.14)]">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer absolute top-3 right-3 z-10 p-2.5 min-h-11 min-w-11 rounded-full hover:bg-surface-container"
          aria-label="Cerrar"
        >
          <Icon name="close" />
        </button>
        <div className="px-5 pb-5 pt-5 pr-14 sm:px-6 sm:pb-6 sm:pr-16">
          <BookingDetailContent
            bookingId={bookingId}
            preview={preview}
            initialView={initialView}
            onUpdated={onUpdated}
          />
        </div>
      </div>
    </div>
  )
}
