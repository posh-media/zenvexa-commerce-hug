export type IconKey =
  | "laptop"
  | "monitor"
  | "smartphone"
  | "tablet"
  | "headphones"
  | "speaker"
  | "watch"
  | "gamepad"
  | "keyboard"
  | "mouse"
  | "camera"
  | "printer"
  | "router"
  | "cpu"
  | "harddrive"
  | "lightbulb"
  | "chair"
  | "plug";

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  stock: number;
  icon: IconKey;
  tone: string;
  badge?: string;
  tags: Array<
    | "flash-sale"
    | "featured"
    | "trending"
    | "new"
    | "best-seller"
    | "special-offer"
  >;
  shortDescription: string;
  description: string;
  highlights: string[];
  specs: Array<{ label: string; value: string }>;
  colors: string[];
  /** Optional Firestore-backed media + filter metadata. */
  images?: string[];
  thumbnail?: string;
  categoryId?: string;
  brandId?: string;
  sku?: string;
  sponsored?: boolean;
  officialStore?: boolean;
  createdAt?: number;
};

export type Category = {
  name: string;
  slug: string;
  icon: IconKey;
  itemCount: number;
  tone: string;
  subcategories: string[];
  description: string;
};

export type Brand = {
  name: string;
  slug: string;
  initials: string;
  productCount: number;
  featured: boolean;
  category: string;
};

export const categories: Category[] = [
  {
    name: "Computers",
    slug: "computers",
    icon: "laptop",
    itemCount: 1284,
    tone: "bg-[#F3F5FA]",
    subcategories: ["Laptops", "Desktops", "Workstations", "Chromebooks", "Mini PCs"],
    description:
      "Ultrabooks, creator laptops and desktop towers built for demanding work.",
  },
  {
    name: "Electronics",
    slug: "electronics",
    icon: "camera",
    itemCount: 2140,
    tone: "bg-[#F6F4FA]",
    subcategories: ["Cameras", "Televisions", "Projectors", "Audio", "Wearables"],
    description: "Cameras, displays and audio gear from the brands people trust.",
  },
  {
    name: "Gadgets",
    slug: "gadgets",
    icon: "smartphone",
    itemCount: 1760,
    tone: "bg-[#F4F7F6]",
    subcategories: ["Smartphones", "Tablets", "Smartwatches", "E-readers", "Drones"],
    description: "Phones, tablets and wearables with same-week delivery.",
  },
  {
    name: "Gaming",
    slug: "gaming",
    icon: "gamepad",
    itemCount: 932,
    tone: "bg-[#FAF4F4]",
    subcategories: ["Consoles", "Controllers", "Gaming Laptops", "Headsets", "Chairs"],
    description: "Consoles, controllers and high refresh rate battle stations.",
  },
  {
    name: "Smart Home",
    slug: "smart-home",
    icon: "lightbulb",
    itemCount: 611,
    tone: "bg-[#F7F6F1]",
    subcategories: ["Lighting", "Security", "Speakers", "Thermostats", "Plugs"],
    description: "Lighting, security and voice assistants that work together.",
  },
  {
    name: "Office",
    slug: "office",
    icon: "printer",
    itemCount: 745,
    tone: "bg-[#F4F6F9]",
    subcategories: ["Printers", "Monitors", "Desks", "Chairs", "Shredders"],
    description: "Everything for a workspace that looks as good as it performs.",
  },
  {
    name: "Networking",
    slug: "networking",
    icon: "router",
    itemCount: 428,
    tone: "bg-[#F5F4F8]",
    subcategories: ["Routers", "Mesh Systems", "Switches", "Access Points", "Modems"],
    description: "Wi-Fi 7 mesh, switches and enterprise-grade access points.",
  },
  {
    name: "Accessories",
    slug: "accessories",
    icon: "plug",
    itemCount: 3120,
    tone: "bg-[#F7F7F9]",
    subcategories: ["Keyboards", "Mice", "Chargers", "Storage", "Cables"],
    description: "Keyboards, storage, chargers and the small things that matter.",
  },
];

export const brands: Brand[] = [
  { name: "Apple", slug: "apple", initials: "AP", productCount: 184, featured: true, category: "Computers" },
  { name: "Samsung", slug: "samsung", initials: "SM", productCount: 246, featured: true, category: "Electronics" },
  { name: "Sony", slug: "sony", initials: "SN", productCount: 173, featured: true, category: "Electronics" },
  { name: "Dell", slug: "dell", initials: "DL", productCount: 158, featured: true, category: "Computers" },
  { name: "Lenovo", slug: "lenovo", initials: "LN", productCount: 141, featured: true, category: "Computers" },
  { name: "Asus", slug: "asus", initials: "AS", productCount: 132, featured: true, category: "Gaming" },
  { name: "Logitech", slug: "logitech", initials: "LG", productCount: 209, featured: false, category: "Accessories" },
  { name: "Anker", slug: "anker", initials: "AN", productCount: 187, featured: false, category: "Accessories" },
  { name: "Bose", slug: "bose", initials: "BO", productCount: 74, featured: false, category: "Electronics" },
  { name: "Razer", slug: "razer", initials: "RZ", productCount: 96, featured: false, category: "Gaming" },
  { name: "HP", slug: "hp", initials: "HP", productCount: 164, featured: false, category: "Office" },
  { name: "Canon", slug: "canon", initials: "CN", productCount: 88, featured: false, category: "Electronics" },
  { name: "Ubiquiti", slug: "ubiquiti", initials: "UB", productCount: 52, featured: false, category: "Networking" },
  { name: "Philips Hue", slug: "philips-hue", initials: "PH", productCount: 61, featured: false, category: "Smart Home" },
  { name: "Keychron", slug: "keychron", initials: "KC", productCount: 43, featured: false, category: "Accessories" },
  { name: "Herman Miller", slug: "herman-miller", initials: "HM", productCount: 29, featured: false, category: "Office" },
];

const tones = [
  "bg-[#F4F6FA]",
  "bg-[#F7F5FA]",
  "bg-[#F4F8F7]",
  "bg-[#FAF5F4]",
  "bg-[#F8F7F2]",
  "bg-[#F6F6F9]",
];

type Seed = Omit<Product, "id" | "slug" | "tone" | "specs" | "colors"> & {
  specs?: Array<{ label: string; value: string }>;
  colors?: string[];
};

const seeds: Seed[] = [
  {
    name: 'MacBook Pro 14" M4 Pro',
    brand: "Apple",
    category: "Computers",
    subcategory: "Laptops",
    price: 1999,
    oldPrice: 2299,
    rating: 4.9,
    reviews: 1284,
    stock: 12,
    icon: "laptop",
    badge: "Editor's choice",
    tags: ["featured", "best-seller", "trending"],
    shortDescription: "14-core CPU, 20-core GPU, 24GB unified memory, 1TB SSD.",
    description:
      "The 14-inch MacBook Pro pairs the M4 Pro chip with a Liquid Retina XDR display, giving you desktop-class performance in a chassis that still fits in a sleeve. Twenty hours of battery, three Thunderbolt 5 ports and a six-speaker sound system make it the most complete pro laptop we stock.",
    highlights: [
      "M4 Pro chip with 14-core CPU and 20-core GPU",
      "Liquid Retina XDR display, 1600 nits peak brightness",
      "Up to 20 hours of battery life",
      "Thunderbolt 5, HDMI, SDXC and MagSafe 3",
    ],
    specs: [
      { label: "Processor", value: "Apple M4 Pro (14-core)" },
      { label: "Memory", value: "24GB unified memory" },
      { label: "Storage", value: "1TB SSD" },
      { label: "Display", value: '14.2" Liquid Retina XDR, 120Hz' },
      { label: "Weight", value: "1.60 kg" },
      { label: "Warranty", value: "1 year limited" },
    ],
    colors: ["Space Black", "Silver"],
  },
  {
    name: "Dell UltraSharp 32 4K Monitor",
    brand: "Dell",
    category: "Office",
    subcategory: "Monitors",
    price: 749,
    oldPrice: 899,
    rating: 4.7,
    reviews: 642,
    stock: 34,
    icon: "monitor",
    tags: ["featured", "special-offer"],
    shortDescription: "31.5-inch IPS Black panel with 98% DCI-P3 and USB-C hub.",
    description:
      "A colour-accurate 4K panel with a built-in 90W USB-C dock, so a single cable powers your laptop and drives the display. IPS Black technology doubles the contrast of a standard IPS monitor.",
    highlights: [
      "3840 x 2160 at 60Hz, IPS Black",
      "98% DCI-P3 with factory calibration",
      "90W USB-C power delivery",
      "Height, tilt, swivel and pivot adjustable",
    ],
  },
  {
    name: "iPhone 16 Pro 256GB",
    brand: "Apple",
    category: "Gadgets",
    subcategory: "Smartphones",
    price: 1099,
    rating: 4.8,
    reviews: 3218,
    stock: 8,
    icon: "smartphone",
    tags: ["trending", "best-seller"],
    shortDescription: "Titanium body, A18 Pro chip, 48MP Fusion camera system.",
    description:
      "A grade 5 titanium frame, the A18 Pro chip and a 48MP Fusion camera with 5x telephoto. The Super Retina XDR display goes down to 1 nit for late-night reading and up to 2000 nits outdoors.",
    highlights: [
      "6.3-inch Super Retina XDR, ProMotion 120Hz",
      "A18 Pro chip with 6-core GPU",
      "48MP Fusion + 48MP Ultra Wide + 12MP 5x Telephoto",
      "Up to 27 hours video playback",
    ],
  },
  {
    name: "Sony WH-1000XM6 Headphones",
    brand: "Sony",
    category: "Electronics",
    subcategory: "Audio",
    price: 379,
    oldPrice: 449,
    rating: 4.8,
    reviews: 2140,
    stock: 46,
    icon: "headphones",
    badge: "Flash deal",
    tags: ["flash-sale", "best-seller", "featured"],
    shortDescription: "Industry-leading noise cancelling with 30-hour battery.",
    description:
      "Twelve microphones and a dedicated processor read the room 700 times a second, so cabin noise and office chatter simply disappear. Multipoint keeps a laptop and phone connected at once.",
    highlights: [
      "Adaptive noise cancelling with auto ambient mode",
      "30 hours battery, 3 minutes charge for 3 hours playback",
      "LDAC and DSEE Extreme upscaling",
      "Foldable design with hard travel case",
    ],
  },
  {
    name: "PlayStation 5 Pro Console",
    brand: "Sony",
    category: "Gaming",
    subcategory: "Consoles",
    price: 699,
    rating: 4.6,
    reviews: 918,
    stock: 4,
    icon: "gamepad",
    tags: ["trending", "new"],
    shortDescription: "2TB SSD, advanced ray tracing, 8K ready output.",
    description:
      "A 67% larger GPU and advanced ray tracing push 4K games to a steady 60fps, while PSSR upscaling keeps detail intact. Includes a 2TB SSD and the DualSense wireless controller.",
    highlights: [
      "2TB custom NVMe SSD",
      "Advanced ray tracing with PSSR upscaling",
      "Wi-Fi 7 and 8K output support",
      "Backwards compatible with PS4 titles",
    ],
  },
  {
    name: "Keychron Q3 Max Mechanical Keyboard",
    brand: "Keychron",
    category: "Accessories",
    subcategory: "Keyboards",
    price: 219,
    oldPrice: 239,
    rating: 4.7,
    reviews: 412,
    stock: 61,
    icon: "keyboard",
    tags: ["new", "special-offer"],
    shortDescription: "Gasket-mounted aluminium TKL with QMK and 2.4GHz wireless.",
    description:
      "A fully CNC-machined aluminium case, double-gasket mount and pre-lubed switches give a deep, quiet typing feel. QMK and VIA support means every key can be remapped without extra software.",
    highlights: [
      "Full aluminium CNC case",
      "Hot-swappable south-facing switches",
      "2.4GHz, Bluetooth 5.1 and USB-C",
      "QMK / VIA remappable",
    ],
  },
  {
    name: "Logitech MX Master 4S Mouse",
    brand: "Logitech",
    category: "Accessories",
    subcategory: "Mice",
    price: 109,
    oldPrice: 129,
    rating: 4.8,
    reviews: 1876,
    stock: 120,
    icon: "mouse",
    tags: ["best-seller", "flash-sale"],
    shortDescription: "8K DPI sensor, MagSpeed scroll, tracks on glass.",
    description:
      "The shape people buy twice. An 8000 DPI sensor works on glass, MagSpeed scrolling moves 1000 lines a second, and one mouse can drive three machines with Flow.",
    highlights: [
      "8000 DPI Darkfield sensor",
      "MagSpeed electromagnetic scroll wheel",
      "70 days per charge",
      "Logi Flow across three devices",
    ],
  },
  {
    name: "Samsung 990 Pro 2TB NVMe SSD",
    brand: "Samsung",
    category: "Accessories",
    subcategory: "Storage",
    price: 179,
    oldPrice: 219,
    rating: 4.9,
    reviews: 2410,
    stock: 88,
    icon: "harddrive",
    tags: ["best-seller", "special-offer"],
    shortDescription: "PCIe 4.0 with 7,450 MB/s sequential read.",
    description:
      "A PCIe 4.0 drive that stays fast when it is full, with a nickel-coated controller and heat-spreader label to hold clocks under sustained load. Ideal as a boot drive or PS5 expansion.",
    highlights: [
      "7,450 MB/s read, 6,900 MB/s write",
      "1,200 TBW endurance",
      "Dynamic thermal guard",
      "PS5 compatible",
    ],
  },
  {
    name: "ASUS ROG Zephyrus G16 Gaming Laptop",
    brand: "Asus",
    category: "Gaming",
    subcategory: "Gaming Laptops",
    price: 2249,
    oldPrice: 2499,
    rating: 4.6,
    reviews: 486,
    stock: 9,
    icon: "laptop",
    tags: ["featured", "trending"],
    shortDescription: "RTX 5080 Laptop GPU, 16-inch 240Hz OLED, 32GB RAM.",
    description:
      "A 1.5cm aluminium chassis with an RTX 5080 inside. The 16-inch 240Hz OLED covers 100% DCI-P3, so the same machine handles ranked matches and colour work.",
    highlights: [
      "RTX 5080 Laptop GPU, 115W TGP",
      '16" 2.5K 240Hz OLED, 0.2ms response',
      "32GB LPDDR5X, 1TB SSD",
      "Vapour chamber with liquid metal",
    ],
  },
  {
    name: "iPad Pro 11-inch M4 Wi-Fi 256GB",
    brand: "Apple",
    category: "Gadgets",
    subcategory: "Tablets",
    price: 999,
    rating: 4.8,
    reviews: 1042,
    stock: 21,
    icon: "tablet",
    tags: ["featured", "new"],
    shortDescription: "Ultra Retina XDR tandem OLED, 5.1mm thin.",
    description:
      "Two OLED panels stacked to reach 1600 nits peak HDR brightness, in the thinnest product Apple has ever built. Works with Apple Pencil Pro and the Magic Keyboard.",
    highlights: [
      "Tandem OLED Ultra Retina XDR",
      "M4 chip with 10-core CPU",
      "Apple Pencil Pro support",
      "5.1mm thin, 444g",
    ],
  },
  {
    name: "Bose SoundLink Max Speaker",
    brand: "Bose",
    category: "Electronics",
    subcategory: "Audio",
    price: 349,
    oldPrice: 399,
    rating: 4.5,
    reviews: 388,
    stock: 37,
    icon: "speaker",
    tags: ["special-offer", "trending"],
    shortDescription: "Portable stereo with 20 hours battery and IP67 rating.",
    description:
      "A transducer array that fills a room without distorting at volume, wrapped in an IP67 silicone body you can take to the pool. Doubles as a power bank over USB-C.",
    highlights: [
      "20 hours playtime",
      "IP67 water and dust resistant",
      "Custom transducers with passive radiators",
      "USB-C charge out",
    ],
  },
  {
    name: "Samsung Galaxy Watch 7 Classic",
    brand: "Samsung",
    category: "Electronics",
    subcategory: "Wearables",
    price: 429,
    oldPrice: 479,
    rating: 4.4,
    reviews: 512,
    stock: 26,
    icon: "watch",
    tags: ["new", "flash-sale"],
    shortDescription: "Rotating bezel, sapphire crystal, BioActive sensor.",
    description:
      "A stainless steel case with the rotating bezel people keep asking for, plus a BioActive sensor that reads heart rate, body composition and sleep apnoea signals.",
    highlights: [
      "Sapphire crystal, stainless steel",
      "BioActive sensor with ECG",
      "Dual-frequency GPS",
      "40 hours battery",
    ],
  },
  {
    name: "Canon EOS R8 Mirrorless Camera",
    brand: "Canon",
    category: "Electronics",
    subcategory: "Cameras",
    price: 1299,
    oldPrice: 1499,
    rating: 4.7,
    reviews: 264,
    stock: 6,
    icon: "camera",
    tags: ["featured", "special-offer"],
    shortDescription: "24.2MP full-frame sensor, 4K60 oversampled video.",
    description:
      "The full-frame sensor from Canon's flagship in a 461g body, with Dual Pixel autofocus that tracks eyes, animals and vehicles. Uncropped 4K60 comes from 6K oversampling.",
    highlights: [
      "24.2MP full-frame CMOS",
      "Dual Pixel CMOS AF II with subject detection",
      "4K60 from 6K oversampling",
      "40fps electronic shutter",
    ],
  },
  {
    name: "Ubiquiti UniFi Dream Router 7",
    brand: "Ubiquiti",
    category: "Networking",
    subcategory: "Routers",
    price: 279,
    rating: 4.6,
    reviews: 198,
    stock: 42,
    icon: "router",
    tags: ["new", "featured"],
    shortDescription: "Wi-Fi 7 tri-band router with built-in UniFi controller.",
    description:
      "A router, controller and PoE switch in one enclosure. Tri-band Wi-Fi 7 with 6GHz MLO, plus 2.5GbE WAN and per-client traffic identification in the UniFi app.",
    highlights: [
      "Tri-band Wi-Fi 7 with MLO",
      "Built-in UniFi Network controller",
      "2.5GbE WAN, 4x GbE LAN with PoE",
      "Deep packet inspection and IDS/IPS",
    ],
  },
  {
    name: "Philips Hue Starter Kit (4 Bulbs + Bridge)",
    brand: "Philips Hue",
    category: "Smart Home",
    subcategory: "Lighting",
    price: 189,
    oldPrice: 229,
    rating: 4.5,
    reviews: 731,
    stock: 54,
    icon: "lightbulb",
    tags: ["special-offer", "best-seller"],
    shortDescription: "16 million colours, works with every major assistant.",
    description:
      "Four White and Colour Ambiance bulbs plus the Hue Bridge, which keeps automations running locally even when the internet drops. Scenes sync to music, films and games.",
    highlights: [
      "16 million colours and warm-to-cool whites",
      "Local control via Hue Bridge",
      "Works with Alexa, Google Home, HomeKit, Matter",
      "Up to 50 bulbs per bridge",
    ],
  },
  {
    name: "Herman Miller Aeron Chair",
    brand: "Herman Miller",
    category: "Office",
    subcategory: "Chairs",
    price: 1745,
    rating: 4.9,
    reviews: 356,
    stock: 11,
    icon: "chair",
    tags: ["featured", "best-seller"],
    shortDescription: "8Z Pellicle suspension with PostureFit SL support.",
    description:
      "The chair that defined the category, remastered. Eight zones of suspension tension spread your weight, and PostureFit SL supports the sacrum and lumbar independently.",
    highlights: [
      "8Z Pellicle suspension",
      "PostureFit SL lumbar and sacral support",
      "Fully adjustable arms and tilt",
      "12 year warranty",
    ],
  },
  {
    name: "Razer BlackShark V3 Pro Headset",
    brand: "Razer",
    category: "Gaming",
    subcategory: "Headsets",
    price: 199,
    oldPrice: 249,
    rating: 4.4,
    reviews: 623,
    stock: 73,
    icon: "headphones",
    tags: ["flash-sale", "trending"],
    shortDescription: "Esports headset with 70-hour battery and THX spatial audio.",
    description:
      "Tuned with esports pros for positional clarity rather than bass. A detachable broadcast-grade mic, 70-hour battery and simultaneous 2.4GHz plus Bluetooth.",
    highlights: [
      "TriForce Titanium 50mm drivers",
      "THX Spatial Audio",
      "70 hours battery",
      "Detachable HyperClear super wideband mic",
    ],
  },
  {
    name: "HP LaserJet Pro MFP 4301fdn",
    brand: "HP",
    category: "Office",
    subcategory: "Printers",
    price: 429,
    oldPrice: 499,
    rating: 4.3,
    reviews: 187,
    stock: 19,
    icon: "printer",
    tags: ["special-offer"],
    shortDescription: "Mono laser all-in-one, 42ppm, auto duplex, ethernet.",
    description:
      "A workgroup all-in-one that prints 42 pages a minute, scans double-sided in one pass and enrols on the network without a driver install.",
    highlights: [
      "42 ppm mono printing",
      "Single-pass duplex scanning",
      "Gigabit ethernet, no Wi-Fi dependency",
      "50-sheet automatic document feeder",
    ],
  },
  {
    name: "Anker Prime 250W Charging Base",
    brand: "Anker",
    category: "Accessories",
    subcategory: "Chargers",
    price: 149,
    oldPrice: 179,
    rating: 4.6,
    reviews: 908,
    stock: 140,
    icon: "plug",
    tags: ["best-seller", "special-offer"],
    shortDescription: "Six ports, 250W total, live power readout display.",
    description:
      "Enough headroom to charge two laptops, a phone, a tablet and a pair of earbuds at once, with a display showing exactly how much power each port is pulling.",
    highlights: [
      "250W total output across 6 ports",
      "Real-time power display",
      "GaN III thermal design",
      "Retractable braided USB-C included",
    ],
  },
  {
    name: "Lenovo ThinkPad X1 Carbon Gen 13",
    brand: "Lenovo",
    category: "Computers",
    subcategory: "Laptops",
    price: 1679,
    oldPrice: 1899,
    rating: 4.6,
    reviews: 421,
    stock: 17,
    icon: "laptop",
    tags: ["featured", "trending"],
    shortDescription: "Core Ultra 7, 32GB RAM, 1.09kg carbon fibre chassis.",
    description:
      "The business standard: MIL-STD tested, serviceable, and 1.09kg. Core Ultra 7 with an on-die NPU handles local transcription and background blur without touching the battery.",
    highlights: [
      "Intel Core Ultra 7 with NPU",
      "32GB LPDDR5X, 1TB SSD",
      '14" 2.8K OLED touch option',
      "1.09kg carbon fibre chassis",
    ],
  },
  {
    name: "Samsung 65-inch OLED S95F TV",
    brand: "Samsung",
    category: "Electronics",
    subcategory: "Televisions",
    price: 2399,
    oldPrice: 2899,
    rating: 4.7,
    reviews: 342,
    stock: 5,
    icon: "monitor",
    badge: "Save $500",
    tags: ["flash-sale", "featured"],
    shortDescription: "QD-OLED, 165Hz, glare-free matte finish.",
    description:
      "A QD-OLED panel with a matte glare-free coating that keeps black levels intact in a bright room, plus 165Hz with four HDMI 2.1 ports for consoles and a PC.",
    highlights: [
      "4K QD-OLED, 165Hz",
      "Glare-free matte coating",
      "4x HDMI 2.1, VRR and ALLM",
      "Object Tracking Sound+",
    ],
  },
  {
    name: "AMD Ryzen 9 9950X Processor",
    brand: "Asus",
    category: "Computers",
    subcategory: "Workstations",
    price: 589,
    oldPrice: 649,
    rating: 4.8,
    reviews: 297,
    stock: 23,
    icon: "cpu",
    tags: ["trending", "special-offer"],
    shortDescription: "16 cores, 32 threads, 5.7GHz boost, AM5 socket.",
    description:
      "Sixteen Zen 5 cores for compile times and renders, on the AM5 platform so a future upgrade does not mean a new motherboard.",
    highlights: [
      "16 cores / 32 threads",
      "Up to 5.7GHz boost",
      "80MB total cache",
      "AM5 socket, 170W TDP",
    ],
  },
  {
    name: "Google Nest Learning Thermostat",
    brand: "Samsung",
    category: "Smart Home",
    subcategory: "Thermostats",
    price: 249,
    oldPrice: 279,
    rating: 4.4,
    reviews: 655,
    stock: 48,
    icon: "plug",
    tags: ["new"],
    shortDescription: "Adaptive schedule with Soli presence sensing.",
    description:
      "Learns your week in a fortnight and adjusts itself, with a borosilicate glass face that shows weather and temperature from across the room.",
    highlights: [
      "Adaptive learning schedule",
      "Soli presence sensing",
      "Matter and Thread ready",
      "Energy history in the Home app",
    ],
  },
  {
    name: "Elgato Stream Deck MK.2 Plus",
    brand: "Logitech",
    category: "Accessories",
    subcategory: "Keyboards",
    price: 199,
    rating: 4.7,
    reviews: 431,
    stock: 66,
    icon: "keyboard",
    tags: ["new", "trending"],
    shortDescription: "8 LCD keys, 4 dials and a touch strip.",
    description:
      "Eight customisable LCD keys, four dials and a touch strip for scenes, scripts and audio mixing, with plugins for every major streaming and creative app.",
    highlights: [
      "8 LCD keys with custom icons",
      "4 rotary dials and touch strip",
      "Multi-action macros",
      "Works with OBS, Zoom, Photoshop",
    ],
  },
  {
    name: "WD Black P40 Game Drive 2TB",
    brand: "Samsung",
    category: "Gaming",
    subcategory: "Controllers",
    price: 139,
    oldPrice: 169,
    rating: 4.5,
    reviews: 512,
    stock: 91,
    icon: "harddrive",
    tags: ["flash-sale"],
    shortDescription: "2,000 MB/s external SSD with RGB accent lighting.",
    description:
      "USB 3.2 Gen 2x2 speeds in a pocketable aluminium shell, so console libraries move across in minutes instead of an evening.",
    highlights: [
      "Up to 2,000 MB/s read",
      "USB 3.2 Gen 2x2",
      "Customisable RGB",
      "Console and PC compatible",
    ],
  },
  {
    name: "Apple Watch Ultra 3 Titanium",
    brand: "Apple",
    category: "Gadgets",
    subcategory: "Smartwatches",
    price: 799,
    rating: 4.7,
    reviews: 876,
    stock: 14,
    icon: "watch",
    tags: ["best-seller", "featured"],
    shortDescription: "3000 nits display, 100m water resistance, dual GPS.",
    description:
      "Grade 5 titanium, 100m water resistance and a 3000-nit display readable in direct sun. Precision dual-frequency GPS for canyons and cities.",
    highlights: [
      "3000 nit Retina display",
      "42 hours battery, 72 in low power",
      "Dual-frequency GPS",
      "EN13319 dive certified",
    ],
  },
  {
    name: "Netgear Orbi 970 Mesh System (3-pack)",
    brand: "Ubiquiti",
    category: "Networking",
    subcategory: "Mesh Systems",
    price: 1499,
    oldPrice: 1699,
    rating: 4.3,
    reviews: 142,
    stock: 7,
    icon: "router",
    tags: ["special-offer"],
    shortDescription: "Quad-band Wi-Fi 7 covering up to 10,000 sq ft.",
    description:
      "A dedicated 6GHz backhaul between nodes keeps the client bands clear, so coverage across three floors does not cost you throughput.",
    highlights: [
      "Quad-band Wi-Fi 7, 27Gbps",
      "10,000 sq ft coverage",
      "10 Gig internet port",
      "200+ device capacity",
    ],
  },
  {
    name: "Sonos Era 300 Smart Speaker",
    brand: "Sony",
    category: "Smart Home",
    subcategory: "Speakers",
    price: 449,
    oldPrice: 499,
    rating: 4.5,
    reviews: 398,
    stock: 31,
    icon: "speaker",
    tags: ["trending", "special-offer"],
    shortDescription: "Six drivers for spatial audio, Trueplay tuning.",
    description:
      "Six drivers including one firing upward for height channels, tuned to your room with Trueplay. Pairs with a soundbar for wireless surrounds.",
    highlights: [
      "Six-driver spatial audio array",
      "Trueplay room tuning",
      "Wi-Fi 6, Bluetooth and line-in",
      "Works as wireless surround",
    ],
  },
];

function buildProduct(seed: Seed, index: number): Product {
  const slug = seed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return {
    ...seed,
    id: `SB-${(1000 + index).toString()}`,
    slug,
    tone: tones[index % tones.length],
    colors: seed.colors ?? ["Graphite", "Silver", "Midnight"],
    specs:
      seed.specs ??
      [
        { label: "Brand", value: seed.brand },
        { label: "Category", value: `${seed.category} / ${seed.subcategory}` },
        { label: "Model year", value: "2026" },
        { label: "Connectivity", value: "USB-C, Bluetooth 5.4" },
        { label: "In the box", value: "Device, cable, quick start guide" },
        { label: "Warranty", value: "2 year Zenvexa cover" },
      ],
  };
}

export const products: Product[] = seeds.map(buildProduct);

export const productsBySlug = new Map(products.map((p) => [p.slug, p]));

export function byTag(tag: Product["tags"][number], limit?: number) {
  const list = products.filter((p) => p.tags.includes(tag));
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

export function byCategory(slug: string) {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return [];
  return products.filter((p) => p.category === category.name);
}

export const priceBounds = { min: 49, max: 2900 };

export type Review = {
  id: string;
  author: string;
  initials: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  helpful: number;
};

export const reviews: Review[] = [
  {
    id: "r1",
    author: "Daniel Okafor",
    initials: "DO",
    rating: 5,
    date: "12 July 2026",
    title: "Replaced two machines with this one",
    body: "Three weeks in and the fans have not spun up once, even exporting 4K timelines. Battery still shows 40% at the end of a working day.",
    verified: true,
    helpful: 42,
  },
  {
    id: "r2",
    author: "Amara Bello",
    initials: "AB",
    rating: 4,
    date: "3 July 2026",
    title: "Excellent, but bring a dongle",
    body: "Build quality and screen are as good as everyone says. Port selection is fine for me, though I still carry an ethernet adapter for client sites.",
    verified: true,
    helpful: 18,
  },
  {
    id: "r3",
    author: "Kevin Mensah",
    initials: "KM",
    rating: 5,
    date: "28 June 2026",
    title: "Next-day delivery actually was next day",
    body: "Ordered at 6pm, arrived before noon the next morning, packaging sealed. Setup transfer from my old machine took about 20 minutes.",
    verified: true,
    helpful: 27,
  },
  {
    id: "r4",
    author: "Priya Raman",
    initials: "PR",
    rating: 4,
    date: "14 June 2026",
    title: "Great value at the sale price",
    body: "Would have hesitated at full price, but at this discount it is an easy recommendation. The finish picks up fingerprints quickly.",
    verified: false,
    helpful: 9,
  },
];

export const ratingBreakdown = [
  { stars: 5, count: 812 },
  { stars: 4, count: 296 },
  { stars: 3, count: 84 },
  { stars: 2, count: 22 },
  { stars: 1, count: 12 },
];

export type OrderStatus =
  | "Completed"
  | "Pending"
  | "Cancelled"
  | "Returned"
  | "Shipped";

export type Order = {
  id: string;
  placedOn: string;
  status: OrderStatus;
  total: number;
  items: Array<{ slug: string; name: string; qty: number; price: number; icon: IconKey }>;
  delivery: string;
  courier: string;
  tracking: string;
  address: string;
  payment: string;
};

export const orders: Order[] = [
  {
    id: "SB-72841",
    placedOn: "2 August 2026",
    status: "Shipped",
    total: 2378,
    delivery: "Arriving Thursday, 7 August",
    courier: "Zenvexa Express · Rider: Musa I.",
    tracking: "SBX-9931-4471",
    address: "18 Adeola Odeku Street, Victoria Island, Lagos 101241",
    payment: "Visa ending 4242",
    items: [
      { slug: "macbook-pro-14-m4-pro", name: 'MacBook Pro 14" M4 Pro', qty: 1, price: 1999, icon: "laptop" },
      { slug: "sony-wh-1000xm6-headphones", name: "Sony WH-1000XM6 Headphones", qty: 1, price: 379, icon: "headphones" },
    ],
  },
  {
    id: "SB-72610",
    placedOn: "21 July 2026",
    status: "Completed",
    total: 928,
    delivery: "Delivered 24 July 2026",
    courier: "DHL Express · AWB 4471 8890",
    tracking: "SBX-8812-2049",
    address: "18 Adeola Odeku Street, Victoria Island, Lagos 101241",
    payment: "Mastercard ending 8899",
    items: [
      { slug: "dell-ultrasharp-32-4k-monitor", name: "Dell UltraSharp 32 4K Monitor", qty: 1, price: 749, icon: "monitor" },
      { slug: "logitech-mx-master-4s-mouse", name: "Logitech MX Master 4S Mouse", qty: 1, price: 109, icon: "mouse" },
    ],
  },
  {
    id: "SB-72402",
    placedOn: "9 July 2026",
    status: "Pending",
    total: 699,
    delivery: "Awaiting stock confirmation",
    courier: "Not assigned yet",
    tracking: "—",
    address: "4 Marina Road, Lagos Island, Lagos 102273",
    payment: "Bank transfer",
    items: [
      { slug: "playstation-5-pro-console", name: "PlayStation 5 Pro Console", qty: 1, price: 699, icon: "gamepad" },
    ],
  },
  {
    id: "SB-71988",
    placedOn: "27 June 2026",
    status: "Cancelled",
    total: 219,
    delivery: "Cancelled by customer",
    courier: "—",
    tracking: "—",
    address: "18 Adeola Odeku Street, Victoria Island, Lagos 101241",
    payment: "Refunded to Visa ending 4242",
    items: [
      { slug: "keychron-q3-max-mechanical-keyboard", name: "Keychron Q3 Max Mechanical Keyboard", qty: 1, price: 219, icon: "keyboard" },
    ],
  },
  {
    id: "SB-71620",
    placedOn: "11 June 2026",
    status: "Returned",
    total: 349,
    delivery: "Refund completed 19 June 2026",
    courier: "Zenvexa Returns",
    tracking: "SBR-5512-7781",
    address: "18 Adeola Odeku Street, Victoria Island, Lagos 101241",
    payment: "Refunded to wallet",
    items: [
      { slug: "bose-soundlink-max-speaker", name: "Bose SoundLink Max Speaker", qty: 1, price: 349, icon: "speaker" },
    ],
  },
];

export const orderTimeline = [
  {
    label: "Ordered",
    description: "Payment confirmed · 2 Aug, 09:14",
    state: "done" as const,
  },
  {
    label: "Packed",
    description: "Packed at Lagos fulfilment centre · 2 Aug, 17:40",
    state: "done" as const,
  },
  {
    label: "Shipped",
    description: "Left the warehouse · 3 Aug, 06:05",
    state: "done" as const,
  },
  {
    label: "Out for delivery",
    description: "With rider Musa I. · expected today, 14:00–17:00",
    state: "current" as const,
  },
  {
    label: "Delivered",
    description: "Signature required on arrival",
    state: "upcoming" as const,
  },
];

export type Notification = {
  id: string;
  type: "Orders" | "Shipping" | "Promotions" | "Offers";
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

export const notifications: Notification[] = [
  {
    id: "n1",
    type: "Shipping",
    title: "Order SB-72841 is out for delivery",
    body: "Your MacBook Pro and headphones are with rider Musa I. and arrive between 14:00 and 17:00 today.",
    time: "12 minutes ago",
    unread: true,
  },
  {
    id: "n2",
    type: "Offers",
    title: "Price drop on an item in your wishlist",
    body: "The Samsung 65-inch OLED S95F is now $2,399 — $500 below the price when you saved it.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: "n3",
    type: "Orders",
    title: "Invoice ready for order SB-72610",
    body: "Your invoice for the Dell UltraSharp 32 and MX Master 4S is ready to download.",
    time: "Yesterday, 18:22",
    unread: true,
  },
  {
    id: "n4",
    type: "Promotions",
    title: "Flash sale starts in 3 hours",
    body: "Up to 45% off audio, storage and networking. Members get 20 minutes of early access.",
    time: "Yesterday, 09:00",
    unread: false,
  },
  {
    id: "n5",
    type: "Shipping",
    title: "Order SB-72610 delivered",
    body: "Delivered and signed for by A. Bello on 24 July at 11:38.",
    time: "24 July",
    unread: false,
  },
  {
    id: "n6",
    type: "Offers",
    title: "You have 2,400 Zenvexa points",
    body: "That is $24 off your next order. Points apply automatically at checkout.",
    time: "20 July",
    unread: false,
  },
];

export const faqs = [
  {
    question: "How fast is delivery?",
    answer:
      "Orders placed before 6pm on a weekday are dispatched the same day. Express covers most metro addresses next day, standard delivery takes two to four working days, and you will see an exact window at checkout before you pay.",
  },
  {
    question: "What is the returns window?",
    answer:
      "Thirty days from delivery on anything unopened, and fourteen days on opened electronics provided all accessories are included. Start a return from Order History and we will send a prepaid label.",
  },
  {
    question: "Are products covered by warranty?",
    answer:
      "Every product carries the manufacturer warranty, and most items add two years of Zenvexa cover at no extra cost. Warranty claims are handled in-house, so you never chase a manufacturer yourself.",
  },
  {
    question: "Can I pay in instalments?",
    answer:
      "Yes. Orders above $300 can be split across three or six months at checkout with no interest on the three-month plan.",
  },
  {
    question: "Do you price match?",
    answer:
      "If you find a lower advertised price from an authorised retailer within seven days of your order, we refund the difference. Send the link to support and we handle the rest.",
  },
  {
    question: "How do I track an order?",
    answer:
      "Open Track Order and enter your order number, or tap the order in your history. You will see live courier status, the rider's name and the delivery window.",
  },
];

export const recentSearches = [
  "gaming laptop rtx 5080",
  "4k monitor usb-c",
  "noise cancelling headphones",
  "mechanical keyboard 75%",
  "wifi 7 mesh",
];

export const popularSearches = [
  "MacBook Pro M4",
  "PS5 Pro",
  "OLED TV 65 inch",
  "Anker charger",
  "NVMe 2TB",
  "Apple Watch Ultra",
  "Stream Deck",
  "Herman Miller",
];

export const addresses = [
  {
    id: "a1",
    label: "Home",
    name: "Amara Bello",
    line: "18 Adeola Odeku Street, Victoria Island",
    city: "Lagos 101241, Nigeria",
    phone: "+234 801 234 5678",
    isDefault: true,
  },
  {
    id: "a2",
    label: "Office",
    name: "Amara Bello",
    line: "4 Marina Road, 7th Floor, Lagos Island",
    city: "Lagos 102273, Nigeria",
    phone: "+234 809 876 5432",
    isDefault: false,
  },
];

export const paymentMethods = [
  { id: "p1", brand: "Visa", last4: "4242", expiry: "08/29", isDefault: true },
  { id: "p2", brand: "Mastercard", last4: "8899", expiry: "02/28", isDefault: false },
];

export const cartLines = [
  { slug: "macbook-pro-14-m4-pro", qty: 1 },
  { slug: "sony-wh-1000xm6-headphones", qty: 1 },
  { slug: "samsung-990-pro-2tb-nvme-ssd", qty: 2 },
];

export const savedForLater = ["logitech-mx-master-4s-mouse", "keychron-q3-max-mechanical-keyboard"];

export const wishlistSlugs = [
  "samsung-65-inch-oled-s95f-tv",
  "apple-watch-ultra-3-titanium",
  "herman-miller-aeron-chair",
  "canon-eos-r8-mirrorless-camera",
  "ubiquiti-unifi-dream-router-7",
  "sonos-era-300-smart-speaker",
];

export const recentlyViewedSlugs = [
  "ipad-pro-11-inch-m4-wi-fi-256gb",
  "razer-blackshark-v3-pro-headset",
  "anker-prime-250w-charging-base",
  "lenovo-thinkpad-x1-carbon-gen-13",
];

export function resolve(slugs: string[]) {
  return slugs
    .map((slug) => productsBySlug.get(slug))
    .filter((p): p is Product => Boolean(p));
}

export const user = {
  name: "Amara Bello",
  initials: "AB",
  email: "amara.bello@example.com",
  phone: "+234 801 234 5678",
  joined: "Member since March 2023",
  tier: "Zenvexa Plus",
  points: 2400,
  orders: 34,
  wishlist: 6,
  reviews: 11,
};
