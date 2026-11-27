---
version: alpha-neo-chinese-rooms
name: canho.com Room Showcase (Neo-Chinese Luxury)
description: |
  Room listing and detail card design for canho.com ("Đẳng cấp tạo nên thương hiệu"),
  adapting the Booking.com search/room card layout structure (photo gallery/thumbnail,
  structured room specs, clear pricing, status indicator, and primary/secondary actions)
  into a refined Modern Neo-Chinese Luxury aesthetic with warm rice-paper/ivory surfaces,
  rosewood/wood borders and typography, modern crimson accents, and subtle gold trim.
brand:
  logoText: "canho.com"
  slogan: "Đẳng cấp tạo nên thương hiệu"
source:
  layoutBase: "Booking.com search/room listing card structure (DESIGN.md)"
  styleDirection: "Modern Neo-Chinese Luxury (Đỏ hiện đại, Gỗ tự nhiên, Ánh kim, Nền sáng ấm)"
extractedAt: 2026-11-26
tokensMeasured: true
colors:
  primary: "#FFFFFF"
  accent: "#A6342E"
  accentHover: "#872621"
  canvas: "#F7F4EE"
  surface-alt: "#3A251D"
  on-primary: "#24120E"
  ink: "#6E5A4F"
  gold: "#C69C49"
  hairline: "#E6DDD0"
  neutral-1: "#8C7769"
  neutral-2: "#EFE9DE"
  status-available-paid: "#1F6E5A"
  status-occupied-unpaid: "#A6342E"
  status-maintenance-reserved: "#B45309"
typography:
  heading-sm:
    fontFamily: "Noto Serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0px
  heading-xs:
    fontFamily: "Be Vietnam Pro"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0px
  heading-xs-loose:
    fontFamily: "Be Vietnam Pro"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 2.2
    letterSpacing: 0px
  body-xl:
    fontFamily: "Noto Serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: 0px
  body-lg:
    fontFamily: "Be Vietnam Pro"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  body-lg-strong:
    fontFamily: "Be Vietnam Pro"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0px
  body-md:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0px
  body-md-strong:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.43
    letterSpacing: 0px
  body-sm:
    fontFamily: "Be Vietnam Pro"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.54
    letterSpacing: 0px
  button-xl:
    fontFamily: "Be Vietnam Pro"
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0px
  button-lg:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: 0px
  label:
    fontFamily: "Be Vietnam Pro"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.17
    letterSpacing: 0px
  caption-xs:
    fontFamily: "Be Vietnam Pro"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  caption-xs-strong:
    fontFamily: "Be Vietnam Pro"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0px
rounded:
  none: 0px
  xs: 6px
  sm: 8px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
shadows:
  sm: "rgba(36, 18, 14, 0.14) 0px 2px 8px 0px"
elevationStrategy: single-tier
breakpoints:
  - width: 375
    containerWidth: 375
    gridColumns: 1
    sectionPaddingX: 16
  - width: 768
    containerWidth: 768
    gridColumns: 2
    sectionPaddingX: 16
  - width: 1024
    containerWidth: 1024
    gridColumns: 3
    sectionPaddingX: 24
  - width: 1280
    containerWidth: 1280
    gridColumns: 4
    sectionPaddingX: 24
  - width: 1440
    containerWidth: 1440
    gridColumns: 4
    sectionPaddingX: 24
---

# Room Listing & Detail Card System — canho.com (Neo-Chinese Luxury)

## 1. Visual Theme & Layout Purpose
Adapts the structured booking room card layout (left/top room photo + gallery indicator, middle specs/amenities/floor/capacity metadata, right/bottom price + status badge + action buttons) into a **Modern Neo-Chinese Luxury** palette for **canho.com** (*"Đẳng cấp tạo nên thương hiệu"*):
- Warm rice-paper background (`#F7F4EE`), crisp white cards (`#FFFFFF`) with hairline wood borders (`#E6DDD0`) and subtle gold accent rules (`#C69C49`).
- Modern crimson (`#A6342E`, hover `#872621`) for primary booking/deposit/action buttons and key highlights; deep wood (`#3A251D` / `#24120E`) for structural accents, headers, and primary text.

## 2. Room Card Anatomy (Booking-Style Scannable Layout)
1. **Media Frame (`rounded-sm` / `8px`):** Displays room photo loaded from MongoDB (`data:image/...;base64,...` or stored binary/URL served from DB), multi-photo counter badge (e.g., `1/6` hoặc số ảnh), and status badge (`Trống` `#1F6E5A`, `Đang giữ chỗ` / `Bảo trì` `#B45309`, `Đang thuê` `#A6342E`).
2. **Core Info & Specs Column:**
   - Room code & title (`heading-xs` / `16px` bold + `Noto Serif` building/room label), floor, area (`m²`), max occupants (`người`), and key amenities/assets pills (`#EFE9DE` surface with `#E6DDD0` border).
   - Short description & key-card/access summary (`body-sm` / `13px`, `#6E5A4F`).
3. **Price & Action Column:**
   - Monthly rent (`tabular-nums`, `body-xl` / `24px` bold in `#24120E` or `#A6342E`) + default deposit note (`caption-xs`).
   - Primary action button (`#A6342E` fill, `#FFFFFF` text, `rounded-xs` or `rounded-full` per button role) to view details / book viewing / deposit / manage room, plus secondary outline button (`1px solid #C69C49` or `#A6342E`).

## 3. Interaction, Focus & Elevation Rules
- Single-tier subtle shadow on hover/elevation: `rgba(36, 18, 14, 0.14) 0px 2px 8px 0px` with `1px solid #C69C49` / `#E6DDD0` border.
- Keyboard/focus ring: `2px solid #C69C49` on interactive elements; disabled state opacity `0.8`.
- Minimum touch target height `44px` on mobile (`375px`) and desktop (`1024px+`).