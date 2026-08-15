
"use client"
import Image from "next/image"
import { ArrowRight, Globe, Layers, Shield, Truck, Users, Zap } from "lucide-react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@plaspool/ui"
import Link from "next/link"

export default function PlaspoolLanding() {
  return (
    <div className="min-h-screen bg-slate-100 font-mono">


      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiMxMTEiIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMzB2MzBIMzB6IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iLjUiLz48cGF0aCBkPSJNMCAzMGgzMHYzMEgweiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9Ii41Ii8+PC9nPjwvc3ZnPg==')] bg-[size:60px_60px] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge
                  variant="secondary"
                  className="bg-blue-800/40 text-blue-200 border-blue-700/30 font-mono text-xs tracking-wider"
                >
                  Precision Engineering
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold leading-tight tracking-tight">
                  Premium 3D Printer
                  <span className="text-blue-300"> Filaments</span>
                </h1>
                <p className="text-xl text-slate-300 leading-relaxed font-light">
                  Engineered for excellence. Manufactured with precision. Delivered globally. PlaSpool provides
                  high-quality PLA filaments for makers, professionals, and industrial users worldwide.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="/shop">
                <Button size="lg" className="bg-blue-800 text-gray-200 hover:bg-blue-700 font-mono">
                  Shop Filaments <ArrowRight className="ml-2 w-4 h-4" />
                </Button></a>
                <a href="#specs">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-400 bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono"
                >
                  View Specifications
                </Button></a>
              </div>
              
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-blue-800/20 to-blue-900/20 rounded-3xl p-8 backdrop-blur-sm border border-white/10">
                <Image
                  src="/filament_cta2.jpg"
                  alt="3D Printer Filament Spools"
                  width={2000}
                  height={1300}
                  className="w-full h-full object-cover rounded-2xl"
                />
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-700/30 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-900/30 rounded-full blur-xl" />

              {/* Technical blueprint overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM0QjgzRkYiIHN0cm9rZS13aWR0aD0iLjUiIG9wYWNpdHk9Ii4yIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjIwIi8+PGxpbmUgeDE9IjIwIiB5MT0iNTAiIHgyPSI4MCIgeTI9IjUwIi8+PGxpbmUgeDE9IjUwIiB5MT0iMjAiIHgyPSI1MCIgeTI9IjgwIi8+PC9nPjwvc3ZnPg==')] bg-no-repeat bg-center opacity-20" />
            </div>
          </div>
        </div>
      </section>

      {/* Who We Are */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-blue-900 border-blue-200 font-mono text-xs tracking-wider">
                  Who We Are
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
                  West Africa’s First 3D Printing Filament Producer
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed">
                  Based in Abuja, Nigeria, PlaSpool specializes in manufacturing high-quality 3D printer filaments for
                  makers, professionals, and industrial users alike. We combine local expertise with global standards to
                  deliver materials that perform consistently, every time.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Shield className="w-8 h-8 text-blue-900" />
                  <h3 className="font-semibold text-slate-900 tracking-wide">Quality Assured</h3>
                  <p className="text-sm text-slate-600">
                    Strict quality controls ensure uniform diameter and smooth extrusion
                  </p>
                </div>
                <div className="space-y-2">
                  <Zap className="w-8 h-8 text-blue-900" />
                  <h3 className="font-semibold text-slate-900 tracking-wide">Innovation Driven</h3>
                  <p className="text-sm text-slate-600">
                    Cutting-edge manufacturing processes for superior performance
                  </p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] bg-slate-100 rounded-2xl overflow-hidden">
                <Image
                  src="/filament_cta1.jpg"
                  alt="PlaSpool Manufacturing Facility"
                  width={2000}
                  height={1300}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent rounded-2xl" />

              {/* Technical measurement overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iLjUiIG9wYWNpdHk9Ii4xIj48cGF0aCBkPSJNMCAwaDEwMHYxMDBIMHoiLz48cGF0aCBkPSJNMjUgMHYxMDBNNTAgMHYxMDBNNzUgMHYxMDBNMCAyNWgxMDBNMCA1MGgxMDBNMCA3NWgxMDAiLz48L2c+PC9zdmc+')] bg-[size:50px_50px] opacity-10" />
            </div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section id="products" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="text-blue-900 border-blue-200 font-mono text-xs tracking-wider">
              What We Do
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">Engineered for Excellence</h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              PlaSpool is a filament manufacturer focused on providing top-tier 3D printing materials. Currently
              specializing in PLA filaments with plans for expansion.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-green-700" />
                </div>
                <CardTitle className="text-xl text-gray-700 tracking-tight">PLA Filaments</CardTitle>
                <CardDescription>Easy-to-print, biodegradable, perfect for beginners and pros alike</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Diameter Tolerance</span>
                    <span className="text-slate-800 font-medium">±0.02mm</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Print Temperature</span>
                    <span className="text-slate-800 font-medium">190-220°C</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Bed Temperature</span>
                    <span className="text-slate-800 font-medium">50-60°C</span>
                  </div>
                </div>
                
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-900" />
                </div>
                <CardTitle className="text-xl tracking-tight text-gray-700">For Everyone</CardTitle>
                <CardDescription>From individual makers to businesses in need of bulk supply</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-slate-600 font-mono">
                  <li>Individual makers & hobbyists</li>
                  <li>Educational institutions</li>
                  <li>Professional and Industrial prototyping</li>
                </ul>
                
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-slate-700" />
                </div>
                <CardTitle className="text-xl tracking-tight text-gray-700">Quality Control</CardTitle>
                <CardDescription>Strict quality controls ensure consistent performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-slate-600 font-mono">
                  <li>Uniform diameter control</li>
                  <li>Batch quality tracking</li>
                  <li>Performance validation</li>
                </ul>
          
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

        <section id="specs" className="py-16 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <Badge variant="outline" className="text-blue-900 border-blue-200 font-mono text-xs tracking-wider">
              Technical Data
            </Badge>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Engineering Specifications</h2>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider font-mono"
                    >
                      Property
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider font-mono"
                    >
                      Value
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider font-mono"
                    >
                      Test Method
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200 font-mono text-sm">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900">Diameter Tolerance</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">±0.02mm</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">Laser Micrometer</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900">Roundness</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">≥ 95%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">Optical Measurement</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900">Tensile Strength</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">50 MPa</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">ASTM D638</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900">Print Temperature</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">190-220°C</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">Thermal Analysis</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Global Reach */}
      <section id="global" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="text-blue-900 border-blue-200 font-mono text-xs tracking-wider">
              Where We Operate
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
              Global Reach from Abuja, Nigeria
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              PlaSpool operates globally from our base in Abuja, Nigeria. Our logistics partners ensure fast and safe
              delivery of your filament, no matter where you print.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-red-700" />
              </div>
              <h3 className="font-semibold text-slate-900 tracking-wide">Africa</h3>
              <p className="text-sm text-slate-600">Serving the growing African maker community</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-blue-900" />
              </div>
              <h3 className="font-semibold text-slate-900 tracking-wide">Europe</h3>
              <p className="text-sm text-slate-600">Reliable supply to European markets</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-green-700" />
              </div>
              <h3 className="font-semibold text-slate-900 tracking-wide">North America</h3>
              <p className="text-sm text-slate-600">Fast delivery across the Americas</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <Globe className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 tracking-wide">Asia & Beyond</h3>
              <p className="text-sm text-slate-600">Expanding reach to global markets</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-8" id="partnerships">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Partnership Opportunities</h3>
                <p className="text-slate-600">
                  We support partnerships with resellers, distributors, and educators worldwide. Join our global network
                  and bring premium filaments to your local market.
                </p>
                <div className="flex items-center space-x-4">
                  <Truck className="w-5 h-5 text-blue-900" />
                  <span className="text-sm text-slate-600 font-mono">Fast & Safe Delivery</span>
                </div>
                <Link target="blank" href="https://docs.google.com/forms/d/e/1FAIpQLSenTtkWn7eUcv1npGgnYCWojXxJiwbF3FVLvxurB8fgWPjMmA/viewform?usp=dialog" className="inline-block">
                <Button className="bg-blue-900 text-gray-100 hover:bg-blue-800 font-mono">
                  Become a Partner <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                </Link>
              </div>
              <div className="aspect-video bg-slate-200 rounded-xl overflow-hidden">
                <Image
                  src="/worldwide.jpg"
                  alt="Global Shipping Network"
                  width={400}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specifications */}
    

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-900 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Ready to Experience PlaSpool Quality?</h2>
          <p className="text-xl text-blue-100">
            Whether you are printing prototypes, functional parts, or artistic models, PlaSpool delivers reliable
            filament that performs consistently.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/shop">
            <Button size="lg" className="bg-white w-full text-blue-900 hover:bg-slate-100 font-mono">
              Shop Now <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            </a>
            {/* <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 font-mono">
              Request Samples
            </Button> */}
          </div>
        </div>
      </section>
    </div>
  )
}
