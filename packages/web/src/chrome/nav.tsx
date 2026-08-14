"use client"

import { Layers } from "lucide-react"
import Link from "next/link"
import { Button } from "@plaspool/ui"

export default function Nav() {
    return (
         <nav className="bg-white border-b font-mono border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center">
                        <Layers className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xl font-bold text-slate-900 tracking-tight">PlaSpool</span>
                    </Link>
                    <div className="hidden md:flex items-center space-x-8">
                      <Link href="/#about" className="text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        About
                      </Link>
                      <Link target="_blank" rel="noopener noreferrer" href="https://store.plaspool.com/" className="text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        Products
                      </Link>
                      <Link href="/posts" className="text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        Blog
                      </Link>
                      <Link href="/contact" className="text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        Contact Us
                      </Link>
                        <a target="_blank" rel="noopener noreferrer" href="https://store.plaspool.com/" className="t font-medium tracking-wide">
                      <Button className="bg-slate-800 text-white hover:bg-slate-700">Shop Filaments</Button>
                      </a>
                      {/* <Button className="bg-blue-900 hover:bg-blue-800">Contact Us</Button> */}
                    </div>
        
                    {/* Mobile menu button */}
                    <div className="md:hidden">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-900"
                        aria-controls="mobile-menu"
                        aria-expanded="false"
                        onClick={() => document.getElementById("mobile-menu")?.classList.toggle("hidden")}
                      >
                        <span className="sr-only">Open main menu</span>
                        {/* Hamburger icon */}
                        <svg
                          className="block h-6 w-6"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
        
                {/* Mobile menu, show/hide based on menu state */}
                <div className="hidden md:hidden bg-white border-t border-slate-200" id="mobile-menu">
                  <div className="px-2 pt-2 pb-3 space-y-1 font-mono">
                    <Link onClick={() => document.getElementById("mobile-menu")?.classList.toggle("hidden")}
                      href="/#about"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      About
                    </Link>
                    <Link onClick={() => document.getElementById("mobile-menu")?.classList.toggle("hidden")}
                      target="_blank" rel="noopener noreferrer" href="https://store.plaspool.com/"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Products
                    </Link>
                    <Link onClick={() => document.getElementById("mobile-menu")?.classList.toggle("hidden")}
                      href="/posts"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Blog
                    </Link>
                       <Link onClick={() => document.getElementById("mobile-menu")?.classList.toggle("hidden")}
                      href="/contact"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Contact us
                    </Link>
                      <a onClick={() => document.getElementById("mobile-menu")?.classList.toggle("hidden")}
                     target="_blank" rel="noopener noreferrer" href="https://store.plaspool.com/"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                     Shop Filaments
                                        </a>
                  </div>
                </div>
              </nav>
    )}