"use client"
import { useState } from "react";
import { Mail, Phone, Send } from "lucide-react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@plaspool/ui"
import toast, { Toaster } from 'react-hot-toast';


const notify = () => toast('Message sent successfully!', {
  duration: 4000,
  position: 'top-right',
});

const errorNotify = (message: string) => toast.error(message, {
  duration: 4000,
  position: 'top-right',
});
  

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  setSubmitting(true);
  e.preventDefault();

  const form = e.currentTarget;


  const firstName = (form.querySelector("#firstName") as HTMLInputElement).value;
  const lastName = (form.querySelector("#lastName") as HTMLInputElement).value;
  const email = (form.querySelector("#email") as HTMLInputElement).value;
  const phone = (form.querySelector("#phone") as HTMLInputElement).value;
  const subject = (form.querySelector("#subject") as HTMLSelectElement).value;
  const message = (form.querySelector("#message") as HTMLTextAreaElement).value;

  const fullName = `${firstName} ${lastName}`;

  const payload = {
    name: fullName,
    email,
    subject,
    message,
    phone // optionally include phone in message
  };
  console.log("Payload to send:", payload);

  try {
    console.log("Submitting form with payload:", payload);
    const res = await fetch("/api/sendmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.ok) {
      notify();
      form.reset(); 
      setSubmitting(false);
    } else {
      errorNotify(result.message || "Something went wrong.");
      setSubmitting(false);
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    alert("Failed to send message. Please try again later.");
    setSubmitting(false);
  }
};


  return (
    <div className="min-h-screen bg-slate-100 font-mono">
   

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiMxMTEiIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMzB2MzBIMzB6IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iLjUiLz48cGF0aCBkPSJNMCAzMGgzMHYzMEgweiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9Ii41Ii8+PC9nPjwvc3ZnPg==')] bg-[size:60px_60px] opacity-10" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center">
          <div className="space-y-6">
             <Toaster />
            <Badge
              variant="secondary"
              className="bg-blue-800/40 text-blue-200 border-blue-700/30 font-mono text-xs tracking-wider"
            >
              Get In Touch
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
              Contact
              <span className="text-blue-300"> PlaSpool</span>
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed font-light max-w-2xl mx-auto">
              Have questions about our filaments? Need technical support? Want to discuss bulk orders? We&apos;re here to
              help with precision and expertise.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-blue-900" />
              </div>
              <h3 className="font-semibold text-slate-900 tracking-wide">Email Support</h3>
              <div className="space-y-1">
                <p className="text-sm text-slate-600 font-mono">General Inquiries</p>
                <p className="text-blue-900 font-mono font-semibold">hello@plaspool.com</p>
              </div>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-green-700" />
              </div>
              <h3 className="font-semibold text-slate-900 tracking-wide">Phone Support</h3>
              <div className="space-y-1">
                <p className="text-sm text-slate-600 font-mono">Business Hours</p>
                <p className="text-green-700 font-mono font-semibold">+234 905 335 5179</p>
              </div>
            </div>
       
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 items-start">
            {/* Form */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-700 tracking-tight">Send us a Message</CardTitle>
                <CardDescription className="text-slate-600">
                  Fill out the form below and we&apos;ll get back to you within 24 hours during business days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-slate-700 font-mono">
                        First Name *
                      </Label>
                      <Input id="firstName" type="text" required className="font-mono bg-white text-slate-800" placeholder="John" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-slate-700 font-mono">
                        Last Name *
                      </Label>
                      <Input id="lastName" type="text" required className="font-mono bg-white text-slate-800" placeholder="Doe" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700 font-mono">
                      Email Address *
                    </Label>
                    <Input id="email" type="email" required className="font-mono bg-white text-slate-800" placeholder="john.doe@example.com" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-slate-700 font-mono">
                      Phone Number *
                    </Label>
                    <Input id="phone" type="tel" required className="font-mono bg-white text-slate-800" placeholder="+234 XXX XXX XXXX" />
                  </div>

            

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-medium text-slate-700 font-mono">
                      Subject *
                    </Label>
                    <select
                      id="subject"
                      required
                      className="w-full px-3 py-2 border text-white bg-slate-800 border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 font-mono text-sm"
                    >
                      <option value="">Select inquiry type</option>
                      <option value="general">General Inquiry</option>
                      <option value="technical">Technical Support</option>
                      <option value="bulk">Bulk Orders</option>
                      <option value="partnership">Partnership Opportunities</option>
                      <option value="shipping">Shipping & Returns</option>
                      <option value="quality">Quality Issues</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-medium text-slate-700 font-mono">
                      Message *
                    </Label>
                    <Textarea
                      id="message"
                      required
                      rows={6}
                      className="font-mono bg-white text-slate-800"
                      placeholder="Please provide details about your inquiry, including any specific requirements or questions you may have..."
                    />
                  </div>

                  <div className="space-y-4">
                    

                    <Button type="submit" className="w-full text-white bg-slate-800 hover:bg-slate-700 font-mono">
                      {submitting ? "Submitting" : "Submit Message"} <Send className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

        
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      {/* <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Frequently Asked Questions</h2>
            <p className="text-lg text-slate-600">Quick answers to common questions</p>
          </div>

          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">What are your minimum order quantities?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 font-mono">
                  We accept orders starting from 1 spool. For bulk orders (50+ spools), special pricing and terms apply.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">Do you offer custom colors?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 font-mono">
                  Yes, we offer custom color matching for bulk orders. Minimum order quantity of 100 spools applies for
                  custom colors.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">What technical specifications do you provide?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 font-mono">
                  We provide detailed technical datasheets including diameter tolerance, tensile strength, print
                  temperatures, and material safety data sheets (MSDS).
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight">How do you ensure quality consistency?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 font-mono">
                  Every batch undergoes rigorous quality control including diameter measurement, tensile testing, and
                  print quality validation before shipping.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section> */}

     
    </div>
  )
}
