===================
Plaspool Storefront
===================

The public-facing website for Plaspool — Nigerian-made PLA filament for 3D
printing. Built on Next.js with WordPress as a headless content source, so
editorial and catalogue content are authored in WordPress and rendered by a
React front end with full static optimisation and on-demand revalidation.

.. contents:: Contents
   :local:
   :depth: 1


Quick start
===========

.. code-block:: bash

   npm install
   cp .env.example .env    # then fill in the values
   npm run dev

The site is served at http://localhost:3000.

The development server runs with Turbopack. A reachable WordPress instance is
required — ``WORDPRESS_URL`` must point at one before any content route will
render.


Architecture
============

WordPress is the content source and holds no presentation logic. This
application reads from the WordPress REST API at build time, caches
aggressively, and is invalidated by webhook rather than by polling:

.. code-block:: text

   WordPress  ──REST──▶  Next.js  ──▶  Static / ISR pages
       │
       └──webhook──▶  /api/revalidate  ──▶  targeted cache purge

The companion WordPress plugin in ``plugin/`` issues the webhook on content
change. It authenticates with ``WORDPRESS_WEBHOOK_SECRET``, so a purge cannot be
triggered by an unauthenticated caller.


Routes
======

=====================  ==========================================================
Path                   Purpose
=====================  ==========================================================
``/``                  Landing page
``/shop``              Product catalogue
``/posts``             Editorial index
``/posts/[slug]``      Article
``/posts/authors``     Author archives
``/posts/categories``  Category archives
``/posts/tags``        Tag archives
``/shipping``          Shipping information
``/contact``           Contact form
=====================  ==========================================================

API routes
----------

===========================  ================================================
Endpoint                     Purpose
===========================  ================================================
``/api/og``                  Dynamic Open Graph image generation
``/api/revalidate``          Webhook target for WordPress cache invalidation
``/api/sendmail``            Contact form delivery over SMTP
===========================  ================================================


Configuration
=============

Copy ``.env.example`` to ``.env``.

============================  ===============================================
Variable                      Purpose
============================  ===============================================
``WORDPRESS_URL``             Base URL of the WordPress REST API.
                              **Required.**
``WORDPRESS_HOSTNAME``        Hostname, registered as a permitted remote
                              image source. **Required.**
``WORDPRESS_WEBHOOK_SECRET``  Shared secret authenticating revalidation
                              requests. Generate with
                              ``openssl rand -base64 32``.
``EMAIL_HOST``                SMTP host for the contact form.
``EMAIL_PORT``                SMTP port.
``EMAIL_USER``                SMTP username.
``EMAIL_PASS``                SMTP password.
``EMAIL_FROM``                Sender address on outbound mail.
============================  ===============================================

.. warning::

   ``.env`` holds real credentials — SMTP passwords and the webhook secret —
   and is excluded from version control. Never commit populated values.

Site metadata (name, description, canonical domain) is set in
``site.config.ts``; primary navigation is defined in ``menu.config.ts``.


Technology
==========

===================  =========================================================
Layer                Stack
===================  =========================================================
Framework            Next.js 15 (App Router), React 19
Language             TypeScript
Styling              Tailwind CSS, tailwindcss-animate
Components           Radix UI primitives, shadcn/ui conventions
Forms                React Hook Form with Zod resolvers
Content source       WordPress REST API (headless)
Mail                 Nodemailer
Analytics            Vercel Analytics
Consent              vanilla-cookieconsent
===================  =========================================================


Project layout
==============

.. code-block:: text

   app/           App Router routes, layouts and API handlers
   components/    UI components, including Radix-based primitives
   lib/           WordPress client, data fetching, shared utilities
   plugin/        Companion WordPress plugin for revalidation webhooks
   public/        Static assets
   site.config.ts Site name, description and canonical domain
   menu.config.ts Navigation structure


Development
===========

====================  ==============================================
Command               Effect
====================  ==============================================
``npm run dev``       Development server with Turbopack
``npm run build``     Production build
``npm start``         Serve the production build
``npm run lint``      Run Next.js linting
====================  ==============================================


Attribution
===========

Built on the `next-wp <https://github.com/9d8dev/next-wp>`_ template,
Copyright (c) 2024 9d8, used under the MIT License. The full license text is
retained in ``LICENSE``.
