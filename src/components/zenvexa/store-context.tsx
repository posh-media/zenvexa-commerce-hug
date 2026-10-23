import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {products,locations,isDeliveryState,BUDGET_MAX,type DeliveryState,type Product,type CartItem} from '@/lib/commerce';
export type View='shop'|'checkout'|'orders';
export type MockOrder={id:string;total:number;state:DeliveryState;zone:string;payment:string;items:CartItem[];status:string;step:number};
const KEYS={catalog:'zenvexa-catalog-v2',cart:'zenvexa-cart-v2',orders:'zenvexa-orders-v2'};
function read<T>(key:string):T|null{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:null;}catch{return null;}}
function write(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{toast.error('Storage is full — this change will not survive a refresh.');}}
function useStoreState(){
 const [view,setView]=useState<View>('shop');
 const [catalog,setCatalog]=useState<Product[]>(()=>[...products]);
 const [state,setState]=useState<DeliveryState>('Lagos'); const [zone,setZone]=useState('Ikeja');
 const [cart,setCart]=useState<CartItem[]>([]); const [bagOpen,setBagOpen]=useState(false);
 const [quick,setQuick]=useState<Product|null>(null); const [wishlist,setWishlist]=useState<string[]>([]);
 const [category,setCategory]=useState('All Merchandise'); const [search,setSearch]=useState('');
 const [awoof,setAwoof]=useState(false); const [budget,setBudget]=useState(BUDGET_MAX); const [sort,setSort]=useState('featured');
 const [orders,setOrders]=useState<MockOrder[]>(()=>[{id:'ZVX-ORD-8842',total:116450,state:'Lagos',zone:'Lekki Phase 1',payment:'Paystack Checkout',items:[{product:products[2]!,quantity:1},{product:products[5]!,quantity:1}],status:'In Transit',step:3}]);
 const loaded=useRef(false);
 useEffect(()=>{const c=read<Product[]>(KEYS.catalog);const b=read<CartItem[]>(KEYS.cart);const o=read<MockOrder[]>(KEYS.orders);if(c)setCatalog(c);if(b)setCart(b);if(o)setOrders(o);loaded.current=true;
  function sync(e:StorageEvent){if(e.key===KEYS.catalog&&e.newValue)setCatalog(JSON.parse(e.newValue));if(e.key===KEYS.orders&&e.newValue)setOrders(JSON.parse(e.newValue));if(e.key===KEYS.cart&&e.newValue)setCart(JSON.parse(e.newValue));}
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 useEffect(()=>{if(loaded.current)write(KEYS.catalog,catalog);},[catalog]);
 useEffect(()=>{if(loaded.current)write(KEYS.cart,cart);},[cart]);
 useEffect(()=>{if(loaded.current)write(KEYS.orders,orders);},[orders]);
 function go(next:View){setView(next);window.scrollTo({top:0,behavior:'smooth'});}
 function changeState(next:string){if(!isDeliveryState(next))return;const firstZone=locations[next].zones[0];if(!firstZone)return;setState(next);setZone(firstZone);}
 function add(product:Product){setCart(prev=>{const existing=prev.find(i=>i.product.id===product.id);if((existing?.quantity??0)>=product.stock){toast.error('You have reached the available stock.');return prev;}return existing?prev.map(i=>i.product.id===product.id?{...i,quantity:i.quantity+1}:i):[...prev,{product,quantity:1}];});toast.success('Added to your Hug Bag',{description:product.title});}
 function quantity(id:string,n:number){setCart(prev=>prev.flatMap(i=>i.product.id!==id?[i]:n<=0?[]:[{...i,quantity:Math.min(n,i.product.stock)}]));}
 function wish(id:string){setWishlist(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}
 return {view,go,catalog,setCatalog,state,zone,setZone,changeState,cart,setCart,bagOpen,setBagOpen,quick,setQuick,wishlist,wish,category,setCategory,search,setSearch,awoof,setAwoof,budget,setBudget,sort,setSort,orders,setOrders,add,quantity,count:cart.reduce((n,i)=>n+i.quantity,0)};
}
type Store=ReturnType<typeof useStoreState>;
const Context=createContext<Store|null>(null);
export function StoreProvider({children}:{children:ReactNode}){const store=useStoreState();return <Context.Provider value={store}>{children}</Context.Provider>;}
export function useStore(){const store=useContext(Context);if(!store)throw new Error('StoreProvider required');return store;}
