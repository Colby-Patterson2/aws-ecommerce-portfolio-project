import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

const productsTable = process.env.PRODUCTS_TABLE

if (!productsTable) {
  console.error('PRODUCTS_TABLE environment variable is required.')
  process.exit(1)
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const products = [
  {
    id: 'p001',
    name: 'Summit Trail Backpack',
    description: 'Weather-ready 28L daypack with hidden laptop sleeve and reinforced straps.',
    price: 89,
    imageUrl:
      'https://images.unsplash.com/photo-1504274066651-8d31a536b11a?auto=format&fit=crop&w=900&q=80',
    stock: 21,
    category: 'Bags',
  },
  {
    id: 'p002',
    name: 'Aero Knit Runners',
    description: 'Ultra-light training sneakers tuned for all-day city walks.',
    price: 129,
    imageUrl:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    stock: 34,
    category: 'Footwear',
  },
  {
    id: 'p003',
    name: 'Arc Aluminum Bottle',
    description: 'Vacuum-sealed 950ml bottle. Cold for 24h, hot for 12h.',
    price: 38,
    imageUrl:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80',
    stock: 67,
    category: 'Hydration',
  },
  {
    id: 'p004',
    name: 'Field Utility Jacket',
    description: 'Lightweight shell with four utility pockets and breathable lining.',
    price: 168,
    imageUrl:
      'https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?auto=format&fit=crop&w=900&q=80',
    stock: 15,
    category: 'Apparel',
  },
  {
    id: 'p005',
    name: 'Scout Travel Cap',
    description: 'Packable cap with sweat-wick inner band and UV fabric.',
    price: 26,
    imageUrl:
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=900&q=80',
    stock: 44,
    category: 'Accessories',
  },
  {
    id: 'p006',
    name: 'Aurora Camp Light',
    description: 'Rechargeable LED lantern with warm and cool output modes.',
    price: 59,
    imageUrl:
      'https://images.unsplash.com/photo-1529946179074-87642f6204d4?auto=format&fit=crop&w=900&q=80',
    stock: 29,
    category: 'Outdoor',
  },
  {
    id: 'p007',
    name: 'Canyon Duffel 42L',
    description: 'Carry-on friendly duffel with structured base and tuck-away backpack straps.',
    price: 119,
    imageUrl:
'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=900&q=80',
    stock: 18,
    category: 'Bags',
  },
  {
    id: 'p008',
    name: 'Harbor Weekender Tote',
    description: 'Waxed canvas tote sized for two-day trips with interior zip security pocket.',
    price: 72,
    imageUrl:
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80',
    stock: 31,
    category: 'Bags',
  },
  {
    id: 'p009',
    name: 'Drift Everyday Sling',
    description: 'Compact crossbody sling with anti-scratch lining for phone and camera gear.',
    price: 48,
    imageUrl:
      'https://images.unsplash.com/photo-1524499982521-1ffd58dd89ea?auto=format&fit=crop&w=900&q=80',
    stock: 43,
    category: 'Bags',
  },
  {
    id: 'p010',
    name: 'Nomad Packing Cube Set',
    description: 'Three-piece ripstop packing cube set with compression zipper panels.',
    price: 34,
    imageUrl:
      'https://images.unsplash.com/photo-1619451427882-6aaaded0cc61?auto=format&fit=crop&w=900&q=80',
    stock: 52,
    category: 'Bags',
  },
  {
    id: 'p011',
    name: 'Voyage Passport Wallet',
    description: 'RFID-blocking travel wallet with document sleeve and boarding-pass slot.',
    price: 29,
    imageUrl:
      'https://images.unsplash.com/photo-1607082350899-7e105aa886ae?auto=format&fit=crop&w=900&q=80',
    stock: 65,
    category: 'Bags',
  },
  {
    id: 'p012',
    name: 'Glacier Fleece Zip',
    description: 'Mid-weight recycled fleece with smooth outer face and cozy brushed interior.',
    price: 96,
    imageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
    stock: 26,
    category: 'Apparel',
  },
  {
    id: 'p013',
    name: 'Peak Merino Hoodie',
    description: 'Thermo-regulating merino blend hoodie made for layering in changing weather.',
    price: 112,
    imageUrl:
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80',
    stock: 22,
    category: 'Apparel',
  },
  {
    id: 'p014',
    name: 'Skyline Windbreaker',
    description: 'Packable shell with vented back panel and DWR finish for city commutes.',
    price: 88,
    imageUrl:
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80',
    stock: 38,
    category: 'Apparel',
  },
  {
    id: 'p015',
    name: 'Terra Hiking Pants',
    description: 'Four-way stretch trail pants with articulated knees and quick-dry fabric.',
    price: 84,
    imageUrl:
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=80',
    stock: 29,
    category: 'Apparel',
  },
  {
    id: 'p016',
    name: 'Ember Insulated Vest',
    description: 'Lightweight synthetic insulated vest with compact stow pocket.',
    price: 102,
    imageUrl:
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80',
    stock: 24,
    category: 'Apparel',
  },
  {
    id: 'p017',
    name: 'Pulse Performance Tee',
    description: 'Soft technical tee with anti-odor treatment and laser-cut ventilation.',
    price: 36,
    imageUrl:
      'https://images.unsplash.com/photo-1583743814966-8936f37f4f42?auto=format&fit=crop&w=900&q=80',
    stock: 59,
    category: 'Apparel',
  },
  {
    id: 'p018',
    name: 'Aero City Trainers',
    description: 'Responsive EVA foam sneakers built for long urban walks.',
    price: 124,
    imageUrl:
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80',
    stock: 35,
    category: 'Footwear',
  },
  {
    id: 'p019',
    name: 'Delta Trek Sandals',
    description: 'Quick-dry trail sandals with grippy outsole and adjustable heel lock.',
    price: 68,
    imageUrl:
      'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=80',
    stock: 41,
    category: 'Footwear',
  },
  {
    id: 'p020',
    name: 'Comet Trail Socks (2-Pack)',
    description: 'Cushioned ankle socks with targeted mesh channels for airflow.',
    price: 18,
    imageUrl:
      'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=80',
    stock: 77,
    category: 'Footwear',
  },
  {
    id: 'p021',
    name: 'Ridge Climb Boots',
    description: 'Water-resistant mid boots with reinforced toe cap and all-terrain grip.',
    price: 156,
    imageUrl:
      'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=900&q=80',
    stock: 17,
    category: 'Footwear',
  },
  {
    id: 'p022',
    name: 'Harbor Slip-On Loafers',
    description: 'Everyday slip-ons with memory-foam footbed and breathable knit upper.',
    price: 74,
    imageUrl:
      'https://images.unsplash.com/photo-1463100099107-aa0980c362e6?auto=format&fit=crop&w=900&q=80',
    stock: 28,
    category: 'Footwear',
  },
  {
    id: 'p023',
    name: 'Mesa Thermal Flask 1L',
    description: 'Double-wall stainless flask with leakproof cap and cup lid.',
    price: 44,
    imageUrl:
      'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80',
    stock: 46,
    category: 'Hydration',
  },
  {
    id: 'p024',
    name: 'Flow Insulated Tumbler',
    description: '20oz powder-coated tumbler with sliding splash guard.',
    price: 32,
    imageUrl:
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=80',
    stock: 54,
    category: 'Hydration',
  },
  {
    id: 'p025',
    name: 'Summit Camp Mug',
    description: 'Enamel steel mug for camp coffee with heat-safe rolled rim.',
    price: 16,
    imageUrl:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
    stock: 83,
    category: 'Hydration',
  },
  {
    id: 'p026',
    name: 'Hydra Soft Flask 500ml',
    description: 'Compressible hand flask for trail runs with bite-valve cap.',
    price: 22,
    imageUrl:
      'https://images.unsplash.com/photo-1542444459-db63c1abf3b0?auto=format&fit=crop&w=900&q=80',
    stock: 49,
    category: 'Hydration',
  },
  {
    id: 'p027',
    name: 'Scout Travel Cap',
    description: 'Lightweight six-panel cap with foldable brim and sweat-wicking band.',
    price: 26,
    imageUrl:
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=900&q=80',
    stock: 44,
    category: 'Accessories',
  },
  {
    id: 'p028',
    name: 'Breeze Performance Cap',
    description: 'Laser-perforated running cap designed for high-output sessions.',
    price: 24,
    imageUrl:
      'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80',
    stock: 51,
    category: 'Accessories',
  },
  {
    id: 'p029',
    name: 'Crest Wool Scarf',
    description: 'Soft merino scarf with clean edge stitch and breathable warmth.',
    price: 39,
    imageUrl:
      'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80',
    stock: 33,
    category: 'Accessories',
  },
  {
    id: 'p030',
    name: 'Forge Utility Belt',
    description: 'Durable woven belt with low-profile buckle and micro-adjust fit.',
    price: 31,
    imageUrl:
      'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?auto=format&fit=crop&w=900&q=80',
    stock: 40,
    category: 'Accessories',
  },
  {
    id: 'p031',
    name: 'TrekLite Phone Strap',
    description: 'Detachable crossbody phone strap with quick-release connectors.',
    price: 19,
    imageUrl:
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
    stock: 72,
    category: 'Accessories',
  },
  {
    id: 'p032',
    name: 'Harbor Canvas Pouch',
    description: 'Zip pouch for cords and essentials with reinforced zipper tape.',
    price: 17,
    imageUrl:
      'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80',
    stock: 61,
    category: 'Accessories',
  },
  {
    id: 'p033',
    name: 'Orbit Headlamp Pro',
    description: '450-lumen rechargeable headlamp with red-light night mode.',
    price: 58,
    imageUrl:
      'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?auto=format&fit=crop&w=900&q=80',
    stock: 27,
    category: 'Outdoor',
  },
  {
    id: 'p034',
    name: 'Atlas Trek Poles',
    description: 'Collapsible aluminum poles with cork grips and snow baskets.',
    price: 94,
    imageUrl:
      'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=80',
    stock: 19,
    category: 'Outdoor',
  },
  {
    id: 'p035',
    name: 'Cinder Camp Stove',
    description: 'Compact canister stove with piezo ignition and stable pot supports.',
    price: 71,
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    stock: 23,
    category: 'Outdoor',
  },
  {
    id: 'p036',
    name: 'Northfield Picnic Blanket',
    description: 'Water-resistant base blanket with carry handle and snap closure.',
    price: 47,
    imageUrl:
      'https://images.unsplash.com/photo-1532635223-478e5483f8f9?auto=format&fit=crop&w=900&q=80',
    stock: 36,
    category: 'Outdoor',
  },
  {
    id: 'p037',
    name: 'Pioneer Compass Watch',
    description: 'Outdoor analog watch with integrated compass bezel and lume markers.',
    price: 139,
    imageUrl:
      'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=80',
    stock: 14,
    category: 'Outdoor',
  },
  {
    id: 'p038',
    name: 'Lumen Reflective Band Set',
    description: 'High-visibility reflective bands for night running and cycling.',
    price: 14,
    imageUrl:
      'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=900&q=80',
    stock: 88,
    category: 'Outdoor',
  },
  {
    id: 'p039',
    name: 'Rover Utility Knife',
    description: 'Foldable stainless utility knife with secure liner lock.',
    price: 33,
    imageUrl:
      'https://images.unsplash.com/photo-1495693313573-3f58a0f74c51?auto=format&fit=crop&w=900&q=80',
    stock: 39,
    category: 'Outdoor',
  },
  {
    id: 'p040',
    name: 'Tundra Winter Mitts',
    description: 'Insulated winter mitts with water-resistant shell and grippy palm.',
    price: 52,
    imageUrl:
      'https://images.unsplash.com/photo-1548777127-d0b8c7f5b1f3?auto=format&fit=crop&w=900&q=80',
    stock: 30,
    category: 'Accessories',
  },
]

await ddb.send(
  new BatchWriteCommand({
    RequestItems: {
      [productsTable]: products.map((item) => ({
        PutRequest: {
          Item: item,
        },
      })),
    },
  }),
)

console.log(`Seeded ${products.length} products into ${productsTable}.`)
