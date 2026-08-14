import { ContactPage } from "@plaspool/web"

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get help with your order or products',
  description: 'Have a question about your order or need help choosing the right PLA filament? Reach out to PlaSpool. We are here to support you every step of the way.',
}

export default function Contact() {
  return <ContactPage />
}
