"use client";

import { useEffect, useState } from 'react';
import { Metadata } from 'next'

export default function WaitlisterEmbed() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <>
          {/* Hero Section */}
          <section className="relative bg-gradient-to-br font-mono from-slate-900 via-blue-900 to-slate-800 text-white overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiMxMTEiIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMzB2MzBIMzB6IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iLjUiLz48cGF0aCBkPSJNMCAzMGgzMHYzMEgweiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9Ii41Ii8+PC9nPjwvc3ZnPg==')] bg-[size:60px_60px] opacity-10" />
            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center">
              <div className="space-y-6">
              
               
                <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
                  Shop premium 3D printer filaments from us
               
                </h1>
                <p className="text-xl text-slate-300 leading-relaxed font-light max-w-2xl mx-auto">
                  Enjoy fast nationwide and worldwide delivery on every order and take advantage of special discounts when you buy in bulk.

                </p>
              </div>
            </div>
          </section>
    <div
      className="waitlister-form  min-h-[60vh] flex items-center justify-center bg-gray-100 p-4"
      data-waitlist-key="YCgl6I7iKc9n"
      data-height="300px"
      style={{ overflowX: 'hidden', overflowY: 'hidden' }}
    >
      <iframe
        src="https://waitlister.me/form/YCgl6I7iKc9n"
        scrolling="no"
        frameBorder="0"
        style={{
          width: '100%',
          maxWidth: '40rem',
          height: '300px',
          border: 'none',
        }}
      />
    </div>
    </>
  );
}
