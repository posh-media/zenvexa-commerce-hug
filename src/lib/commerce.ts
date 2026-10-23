import power from '@/assets/power-station.jpg';
import phone from '@/assets/phone.jpg.asset.json';
import rice from '@/assets/rice.jpg.asset.json';
import fan from '@/assets/fan.jpg.asset.json';
import adire from '@/assets/adire.jpg.asset.json';
import earbuds from '@/assets/earbuds.jpg.asset.json';
import blender from '@/assets/blender.jpg.asset.json';
import beauty from '@/assets/beauty.jpg.asset.json';
import laptop from '@/assets/laptop.jpg.asset.json';
import oil from '@/assets/oil.jpg.asset.json';
import kaftan from '@/assets/kaftan.jpg.asset.json';
import perfume from '@/assets/perfume.jpg.asset.json';
import {extraRows} from './catalog-data';
const localImages:Record<string,string>={power,fan:fan.url,blender:blender.url,adire:adire.url,kaftan:kaftan.url,rice:rice.url,oil:oil.url,beauty:beauty.url};
export const money = (n:number) => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n);
export const categories = ['All Merchandise','Phones & Gadgets','Home & Power','Naija Fashion & Style','Supermarket & Pantry','Beauty & Personal Care'] as const;
export const categoryEmoji = ['🛍️','📱','⚡','👗','🌾','✨'];
export const locations = {
 Lagos:{fee:1500,zones:['Ikeja','Lekki Phase 1','Victoria Island','Surulere','Yaba','Ajah'],eta:'1 – 2 Business Days'},
 'Abuja (FCT)':{fee:2500,zones:['Wuse II','Maitama','Garki','Gwarinpa'],eta:'1 – 2 Business Days'},
 Rivers:{fee:2800,zones:['Port Harcourt GRA','Trans-Amadi','Rumuokoro','Obio-Akpor'],eta:'1 – 2 Business Days'},
 Oyo:{fee:2000,zones:['Ibadan North','Bodija','Oluyole','Iwo Road'],eta:'1 – 2 Business Days'},
 Kano:{fee:3200,zones:['Nassarawa','Fagge','Tarauni','Sabon Gari'],eta:'1 – 2 Business Days'},
 Enugu:{fee:2700,zones:['Independence Layout','New Haven','Enugu North','Trans-Ekulu'],eta:'1 – 2 Business Days'},
};
export type DeliveryState = keyof typeof locations;
export function isDeliveryState(value: string): value is DeliveryState {
 return Object.prototype.hasOwnProperty.call(locations, value);
}
export type Product={id:string;title:string;category:string;price:number;oldPrice:number;badge:string;vendor:string;specs:string[];description:string;image:string;sku:string;stock:number;rating:number;reviews:number};
const make=(id:string,title:string,category:number,price:number,oldPrice:number,badge:string,vendor:string,specs:string[],description:string,image:string,stock:number,rating:number,reviews:number):Product=>({id,title,category:categories[category] ?? categories[0],price,oldPrice,badge,vendor,specs,description,image,sku:`ZVX-${id.toUpperCase()}-001`,stock,rating,reviews});
export const products=[
 make('eco','EcoFlow Delta 2 Portable Power Station (1024Wh)',2,985000,1120000,'Awoof Deal','Zenvexa Official Power Hub',['1800W AC Output','LiFePO4 3000+ Cycles','Solar Input Ready','5-Year Local Warranty'],'NEPA took light? No wahala. Beat NEPA/PHCN outages effortlessly and keep your home, work and everyday essentials powered.',power,14,4.9,128),
 make('sam','Samsung Galaxy A55 5G (256GB / 8GB RAM)',1,545000,590000,'Best Seller','SlotTech Verified Partner',['Dual SIM 5G (MTN/Airtel Ready)','50MP OIS Camera','256GB ROM / 8GB RAM','5000mAh All-Day Battery'],'Your next everyday upgrade. Brilliant photos, smooth performance and all-day battery, wherever Naija takes you.',phone.url,32,4.8,246),
 make('rice','Royal Stallion Classic Parboiled Rice (50kg Bag)',4,78500,85000,'Household Essential','Zenvexa Agro Direct',['50kg Full Measure','100% Stone-Free','Ideal for Party Jollof'],'From Sunday rice to that legendary party jollof, bring the whole family together with premium, stone-free grains.',rice.url,86,4.7,312),
 make('fan','Binatone 18″ Rechargeable Standing Fan with Remote',2,94000,110000,'Hot Season Pick','Binatone Nigeria Official',['Up to 9 Hours Backup','LED Night Light','USB Charging Port','Remote Control Included'],'Stay cool, even when the light goes off. A powerful, quiet breeze made for the Nigerian hot season.',fan.url,23,4.6,94),
 make('adire','Handcrafted Aso-Oke & Adire Luxe Two-Piece Set',3,42000,52000,'Made in Naija','Lagos Loom Couture',['100% Breathable Cotton-Silk','Authentic Abeokuta Indigo','Sizes S – XXL'],'Heritage meets everyday luxury. Beautifully handcrafted fabric from Abeokuta, tailored for confident Naija style.',adire.url,18,4.9,67),
 make('ora','Oraimo FreePods 4 Active Noise Cancelling Earbuds',1,36500,44000,'Top Rated','Oraimo Flagship Store',['35.5 Hours Battery','HavyBass™ Afrobeats Tuning','Active Noise Cancellation'],'Your Afrobeats, uninterrupted. Rich bass and clear calls in a pocket-sized companion for your daily commute.',earbuds.url,56,4.8,189),
 make('mix','Buchymix 2200W Commercial Heavy-Duty Blender',2,88000,105000,'Kitchen King','HomeChef Nigeria',['Crushes dry beans for Akara/Moi-Moi & tiger nuts','2200W High-Power Motor','2L Large-Capacity Jar'],'Akara mornings just got easier. Blend pepper, dry beans and tiger nuts effortlessly with serious kitchen power.',blender.url,21,4.7,108),
 make('shea','Shea Moisture Raw Shea & Oud Body Glow Bundle',5,28500,34000,'Authentic Import','Nectar Beauty Lounge',['Raw Shea Butter','Warm Oud Scent','Moisturising Body Care Bundle'],'A little self-care, a whole lot of glow. Deeply nourishing shea and beautiful oud for soft, radiant skin.',beauty.url,35,4.8,76),
 make('hp','HP Pavilion 15 (Core i7 13th Gen, 16GB / 512GB SSD)',1,890000,970000,'Tech Pro','Computer Village Verified',['Intel Core i7 13th Gen','16GB RAM / 512GB SSD','15.6″ Full HD Display'],'From big ideas to the daily hustle. Fast, dependable performance for creators, students and professionals.',laptop.url,12,4.7,83),
 make('oil','Devon King’s Pure Vegetable Cooking Oil (5 Litres Keg)',4,19500,22000,'Pantry Saver','Zenvexa Agro Direct',['NAFDAC Certified','5L Factory Sealed','Pure Vegetable Oil'],'The kitchen staple your family trusts. Fresh, factory-sealed vegetable oil for frying, stews and everyday meals.',oil.url,120,4.8,221),
 make('sen','Executive Senator Kaftan Set with Monogram Embroidery',3,65000,78000,'Bespoke Finish','Abuja Royal Threads',['Premium Senator Fabric','Monogram Embroidery','Sizes M – XXXL'],'Make an entrance without saying a word. Refined Nigerian tailoring with a beautiful bespoke monogram finish.',kaftan.url,16,4.9,52),
 make('lat','Lattafa Khamrah Eau De Parfum (100ml Original)',5,46000,55000,'Viral Fragrance','Nectar Beauty Lounge',['100ml Original Eau De Parfum','Warm Amber & Vanilla Notes','Long-Lasting Sillage'],'Warm, rich and unforgettable. The much-loved original fragrance with notes of cinnamon, amber and vanilla.',perfume.url,29,4.8,142),
  ...extraRows.map(([id,title,cat,price,old,badge,vendor,specs,desc,img,stock,rating,reviews])=>make(id,title,cat,price,old,badge,vendor,specs,desc,localImages[img]??img,stock,rating,reviews)),
] satisfies Product[];
export const BUDGET_MAX = 2000000;
export const LOW_STOCK = 15;
export const orderSteps = ['Order Confirmed','Packed at Hub','Out with Dispatch Rider','Delivered with a Hug'] as const;
export function advanceOrder<T extends {step:number;status:string}>(order:T):T{const step=Math.min(4,order.step+1);return {...order,step,status:step===4?'Delivered':step===3?'In Transit':orderSteps[step-1]??order.status};}
export function promoDiscount(code:string,subtotal:number){const c=code.trim().toUpperCase();return c==='HUG10'? Math.round(subtotal*0.1):c==='NAIJA5K'&&subtotal>50000?5000:0;}
export type CartItem={product:Product;quantity:number};
export function cartSubtotal(items:CartItem[]){return items.reduce((sum,i)=>sum+i.product.price*i.quantity,0);}
export function orderTotal(items:CartItem[],state:DeliveryState,code=''){const subtotal=cartSubtotal(items);return Math.max(0,subtotal-promoDiscount(code,subtotal))+(items.length?locations[state].fee:0);}
