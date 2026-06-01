import { QRCodeSVG } from 'qrcode.react'

export function MfaQrCode({ uri }: { uri: string }) {
  return (
    <div className="flex justify-center p-4 bg-white rounded-lg">
      <QRCodeSVG value={uri} size={180} />
    </div>
  )
}
