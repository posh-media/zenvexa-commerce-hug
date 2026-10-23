import {useEffect,useState,type FormEvent} from 'react';
import {Link} from '@tanstack/react-router';
import {AlertTriangle,ArrowLeft,ChevronRight,Info,LogOut,Package,Plus,ShieldAlert,ShoppingCart,Trash2,Wallet,Boxes,Lock} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Brand} from './storefront';
import {useStore} from './store-context';
import {categories,money,LOW_STOCK,orderSteps,advanceOrder,type Product} from '@/lib/commerce';

const ROLE_KEY='zenvexa-role';
export const ADMIN_PASSCODE='admin123';

export function AdminGate(){
 const [role,setRole]=useState<string|null|undefined>(undefined);
 const [code,setCode]=useState('');
 useEffect(()=>{setRole(localStorage.getItem(ROLE_KEY));},[]);
 function login(){localStorage.setItem(ROLE_KEY,'admin');setRole('admin');toast.success('Welcome back, Admin');}
 function submit(e:FormEvent){e.preventDefault();if(code===ADMIN_PASSCODE)login();else toast.error('Incorrect admin passcode.');}
 function logout(){localStorage.removeItem(ROLE_KEY);setRole(null);}
 if(role===undefined)return <div className="admin-shell"/>;
 if(role!=='admin')return <main className="admin-denied"><div className="admin-denied-card"><Brand/><div className="denied-icon"><ShieldAlert/></div><h1>Access Denied — Admin Role Required</h1><p>This portal is for Zenvexa staff. Sign in with the admin passcode to continue.</p><form onSubmit={submit} className="promo-form"><Input type="password" aria-label="Admin passcode" placeholder="Admin passcode" value={code} onChange={e=>setCode(e.target.value)}/><Button type="submit"><Lock/>Sign in</Button></form><Button variant="amber" className="w-full" onClick={login}>Demo Admin Login</Button><small>Demo passcode: admin123 · Preview-only gate, not real security.</small><Link to="/" className="admin-back"><ArrowLeft size={13}/>Back to storefront</Link></div></main>;
 return <AdminPortal onLogout={logout}/>;
}

function AdminPortal({onLogout}:{onLogout:()=>void}){
 const s=useStore();
 const revenue=s.orders.reduce((n,o)=>n+o.total,0);
 const active=s.orders.filter(o=>o.step<4).length;
 const low=s.catalog.filter(p=>p.stock<=LOW_STOCK).length;
 const kpis=[{label:'Total Revenue',value:money(revenue),icon:Wallet},{label:'Active Orders',value:String(active),icon:ShoppingCart},{label:'Catalog SKUs',value:String(s.catalog.length),icon:Boxes},{label:'Low-Stock Alerts',value:String(low),icon:AlertTriangle}];
 return <div className="admin-shell"><header className="admin-header"><div className="container-page admin-header-inner"><Link to="/" aria-label="Zenvexa storefront"><Brand/></Link><span className="admin-pill">Admin Portal</span><div className="ml-auto flex gap-2"><Button variant="hero" asChild><Link to="/"><ArrowLeft/>Storefront</Link></Button><Button variant="amber" onClick={onLogout}><LogOut/>Sign out</Button></div></div></header>
 <main className="container-page view-page"><div className="page-eyebrow">Zenvexa operations</div><h1 className="page-title">Admin Portal</h1><div className="demo-notice"><Info size={15}/>Changes are saved in this browser and show instantly on the storefront and Track Orders.</div>
 <div className="kpi-grid">{kpis.map(k=><div className="kpi-card" key={k.label}><div className="trust-icon"><k.icon/></div><div><small>{k.label}</small><strong>{k.value}</strong></div></div>)}</div>
 <ProductForm/><Inventory/><OrdersTable/></main></div>;
}

function ProductForm(){
 const s=useStore();
 const empty={title:'',category:categories[1] as string,price:'',oldPrice:'',badge:'New Arrival',vendor:'',stock:'',image:'',specs:'',description:''};
 const [f,setF]=useState(empty);
 const set=(k:keyof typeof empty)=>(e:{target:{value:string}})=>setF(prev=>({...prev,[k]:e.target.value}));
 function upload(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;if(file.size>700_000){toast.error('Please use an image under 700KB, or paste an image URL.');return;}const r=new FileReader();r.onload=()=>setF(prev=>({...prev,image:String(r.result)}));r.readAsDataURL(file);}
 function submit(e:FormEvent){e.preventDefault();const price=Number(f.price),old=Number(f.oldPrice)||price,stock=Number(f.stock);const fallback=s.catalog.find(p=>p.category===f.category)?.image??'';
  if(!f.title.trim()||!f.vendor.trim()||!f.description.trim()||price<=0||stock<0||old<price){toast.error('Check the fields: price must be above ₦0 and old price can’t be lower than price.');return;}
  const p:Product={id:`adm-${Date.now()}`,title:f.title.trim(),category:f.category,price,oldPrice:old,badge:f.badge.trim()||'New Arrival',vendor:f.vendor.trim(),stock,description:f.description.trim(),specs:f.specs.split('\n').map(x=>x.trim()).filter(Boolean),image:f.image.trim()||fallback,sku:`ZVX-ADM-${String(s.catalog.length+1).padStart(3,'0')}`,rating:5,reviews:0};
  s.setCatalog(prev=>[p,...prev]);setF(empty);toast.success('Product published',{description:p.title});}
 return <section className="view-section"><h2><Plus size={18} className="text-primary"/>Upload a New Product</h2><form onSubmit={submit}><div className="form-grid admin-form-grid">
  <label className="field full">Product Title<Input required value={f.title} onChange={set('title')} placeholder="e.g. Tecno Camon 30"/></label>
  <label className="field">Category<select value={f.category} onChange={set('category')}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label>
  <label className="field">Badge<Input value={f.badge} onChange={set('badge')}/></label>
  <label className="field">Price (₦)<Input required type="number" min={1} value={f.price} onChange={set('price')}/></label>
  <label className="field">Old Price (₦)<Input type="number" min={1} value={f.oldPrice} onChange={set('oldPrice')}/></label>
  <label className="field">Brand / Supplier<Input required value={f.vendor} onChange={set('vendor')}/></label>
  <label className="field">Stock count<Input required type="number" min={0} step={1} value={f.stock} onChange={set('stock')}/></label>
  <label className="field full">Image URL or upload<div className="flex gap-2"><Input value={f.image.startsWith('data:')?'Uploaded image':f.image} onChange={set('image')} placeholder="https://…"/><Input type="file" accept="image/*" className="max-w-56" onChange={upload}/></div>{f.image&&<img src={f.image} alt="Product preview" className="admin-preview"/>}</label>
  <label className="field">Specs (one per line)<textarea value={f.specs} onChange={set('specs')} placeholder={'128GB storage\n5000mAh battery'}/></label>
  <label className="field">Description<textarea required value={f.description} onChange={set('description')}/></label>
 </div><Button type="submit" className="mt-4"><Plus/>Publish Product</Button></form></section>;
}

function Inventory(){
 const s=useStore();
 function update(id:string,key:'price'|'stock',v:string){const n=Math.max(0,Number(v)||0);s.setCatalog(prev=>prev.map(p=>p.id===id?{...p,[key]:n,...(key==='price'&&n>p.oldPrice?{oldPrice:n}:{})}:p));}
 function remove(p:Product){s.setCatalog(prev=>prev.filter(x=>x.id!==p.id));s.setCart(prev=>prev.filter(i=>i.product.id!==p.id));toast.success('Product removed',{description:p.title});}
 return <section className="view-section"><div className="inventory-heading"><h2><Package size={18} className="text-primary"/>Inventory</h2><span className="stock-badge">{s.catalog.length} active SKUs</span></div><div className="inventory-wrap admin-scroll"><table className="inventory-table"><thead><tr><th>Product / SKU</th><th>Category</th><th>Price (₦)</th><th>Stock</th><th></th></tr></thead><tbody>{s.catalog.map(p=><tr key={p.id}><td className="inventory-title">{p.title}<small>{p.sku} · {p.vendor}</small></td><td>{p.category}</td><td><Input className="admin-num" type="number" min={1} aria-label={`Price for ${p.title}`} value={p.price} onChange={e=>update(p.id,'price',e.target.value)}/></td><td><div className="flex items-center gap-2"><Input className="admin-num" type="number" min={0} aria-label={`Stock for ${p.title}`} value={p.stock} onChange={e=>update(p.id,'stock',e.target.value)}/>{p.stock<=LOW_STOCK&&<span className="low-badge">Low</span>}</div></td><td><Button variant="ghost" size="icon" aria-label={`Delete ${p.title}`} onClick={()=>remove(p)}><Trash2/></Button></td></tr>)}</tbody></table></div></section>;
}

function OrdersTable(){
 const s=useStore();
 return <section className="view-section"><div className="inventory-heading"><h2><ShoppingCart size={18} className="text-primary"/>Orders & Dispatch</h2><span className="stock-badge">{s.orders.length} orders</span></div><div className="inventory-wrap"><table className="inventory-table"><thead><tr><th>Order</th><th>Destination</th><th>Total</th><th>Tracking step</th><th></th></tr></thead><tbody>{s.orders.map(o=><tr key={o.id}><td className="inventory-title">{o.id}<small>{o.payment} · {o.items.reduce((n,i)=>n+i.quantity,0)} items</small></td><td>{o.zone}, {o.state}</td><td className="font-semibold whitespace-nowrap">{money(o.total)}</td><td><span className="stock-badge">{o.step}: {orderSteps[o.step-1]}</span></td><td><Button size="sm" variant="outline" disabled={o.step>=4} onClick={()=>s.setOrders(prev=>prev.map(x=>x.id===o.id?advanceOrder(x):x))}>{o.step>=4?'Delivered':'Advance'}<ChevronRight/></Button></td></tr>)}</tbody></table></div></section>;
}
