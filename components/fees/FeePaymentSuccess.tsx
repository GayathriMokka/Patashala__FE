'use client'

interface FeePaymentSuccessProps {
  receiptNumber: string
  onPrint: () => void
  onClose: () => void
}

export default function FeePaymentSuccess({
  receiptNumber,
  onPrint,
  onClose,
}: FeePaymentSuccessProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4 fee-success-pop">
          <svg
            className="w-12 h-12 text-emerald-600 fee-success-check"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">Payment Successful</h3>
        <p className="text-sm text-slate-500 mb-1">Receipt / Invoice No.</p>
        <p className="text-base font-mono font-semibold text-primary-700 mb-6">{receiptNumber}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={onPrint} className="btn-primary flex-1">
            Print Invoice
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Done
          </button>
        </div>
        <style jsx>{`
          @keyframes pop {
            0% {
              transform: scale(0.5);
              opacity: 0;
            }
            60% {
              transform: scale(1.08);
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes draw {
            0% {
              stroke-dashoffset: 48;
            }
            100% {
              stroke-dashoffset: 0;
            }
          }
          .fee-success-pop {
            animation: pop 0.45s ease-out forwards;
          }
          .fee-success-check path {
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: draw 0.5s ease-out 0.25s forwards;
          }
        `}</style>
      </div>
    </div>
  )
}
