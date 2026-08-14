===================
Plaspool Storefront
===================

The public-facing website for Plaspool — Nigerian-made PLA filament for 3D
printing. Built on Next.js 15 (App Router). Deployment target is Cloudflare
Workers via OpenNext (see *Deployment* below). Blog content is read from a
REST API; there is no local content source and no build-time WordPress
dependency.

.. contents:: Contents
   :local:
   :depth: 1


Quick start
===========

.. code-block:: bash

   npm install
   npm run dev

The site is served at http://localhost:3000. The development server runs
with Turbopack.


Workspace layout
=================

This is an npm workspace monorepo with a single lockfile at the repo root:

.. code-block:: text

   apps/storefront/   Host Next.js app — routes, layouts, API handlers
   packages/blog/      Blog data client and page components
   packages/ui/         Shared UI primitives
   packages/brand/      Brand assets and design tokens
   packages/web/        Shared web utilities

Page components generally live in the packages; routes under
``apps/storefront/app`` are thin re-exports of those package components.

To run a single package's own dev/build/lint (where defined), use npm's
workspace flag, e.g.:

.. code-block:: bash

   npm run dev -w @plaspool/blog


Content source
===============

Blog content comes from a REST API. All access goes through
``packages/blog/src/data/``; the base URL is hardcoded in
``packages/blog/src/data/config.ts`` — there is no environment variable for
it. Post bodies are ProseMirror JSON, rendered through an allow-list
component (``packages/blog/src/components/doc-renderer.tsx``), never raw
HTML. Listing pagination is cursor-based, with no page numbers or total
count. Caching is ISR only — 300 seconds on lists, 3600 seconds on post
detail — and there is no revalidation webhook.


Routes
======

=====================  ==========================================================
Path                   Purpose
=====================  ==========================================================
``/``                  Landing page
``/shop``              Product catalogue
``/posts``             Editorial index
``/posts/[slug]``      Article
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
``/api/sendmail``            Contact form delivery, via Resend over HTTP
===========================  ================================================


Configuration
=============

The app has exactly one secret, set in Cloudflare (not in a file):

============================  ===============================================
Variable                      Purpose
============================  ===============================================
``RESEND_API_KEY``            Contact form delivery via Resend.
============================  ===============================================

Site metadata (name, description, canonical domain) and primary navigation
are defined in config files under ``apps/storefront`` / the relevant package.


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
Content source       REST API (blog admin)
Mail                 Resend, over HTTP
Analytics            Vercel Analytics
Consent              vanilla-cookieconsent
Deployment           Cloudflare Workers, via OpenNext
===================  =========================================================


Development
===========

====================================  ==============================================
Command                               Effect
====================================  ==============================================
``npm run dev``                       Development server with Turbopack
``npm run build``                     Production build of the storefront
``npm run lint``                      Lint the app and the packages
====================================  ==============================================


Deployment
==========

Target deployment is Cloudflare Workers via OpenNext. Config lives in
``apps/storefront/wrangler.jsonc`` and
``apps/storefront/open-next.config.ts``; the root ``package.json`` defines
``npm run preview`` and ``npm run deploy``, which delegate to
``apps/storefront``'s own scripts
(``opennextjs-cloudflare build && opennextjs-cloudflare {preview,deploy}``).

No Cloudflare bindings are configured — ``deploy`` does not require
provisioning any KV/R2/D1 resources first. ISR (see *Caching* above)
therefore does not persist across Worker instances; an R2-backed incremental
cache can be added later if that is needed.

``npm run deploy`` authenticates to and publishes on the account's
Cloudflare account. It is run by a human, never by an agent. Before the
first deploy: ``wrangler login``, then set the mail secret from
``apps/storefront``: ``npx wrangler secret put RESEND_API_KEY``.

``npm run preview`` builds and serves the app locally against the Workers
runtime (via ``wrangler``/``miniflare``) and does not publish anything.


Attribution
===========

Originally scaffolded from the `next-wp <https://github.com/9d8dev/next-wp>`_
template, Copyright (c) 2024 9d8, used under the MIT License. The WordPress
data layer from that template has since been fully replaced by a REST API
client. The original license text is retained in ``LICENSE``.
