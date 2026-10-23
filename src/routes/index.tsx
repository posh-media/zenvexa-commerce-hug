import {createFileRoute} from '@tanstack/react-router';
import {StoreProvider,useStore} from '@/components/zenvexa/store-context';
import {Header,Shop,Footer,Overlays} from '@/components/zenvexa/storefront';
import {Checkout,Orders} from '@/components/zenvexa/views';
import {Toaster} from '@/components/ui/sonner';
export const Route=createFileRoute('/')({
 head:()=>({meta:[{title:'Zenvexa — Everything Naija Needs, Delivered with a Warm Hug'},{name:'description',content:'Shop phones, home power, Nigerian fashion, pantry essentials and beauty from verified Nigerian merchants. Discover Awoof deals at Zenvexa Commerce Hug.'},{property:'og:title',content:'Zenvexa Commerce Hug — Your Everyday, Upgraded'},{property:'og:description',content:'Trusted Nigerian merchants, great Naira prices and everything Naija needs, delivered with a warm hug.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:Index,
});
function Experience(){const s=useStore();return <><Header/>{s.view==='shop'?<Shop/>:s.view==='checkout'?<Checkout/>:<Orders/>}<Footer/><Overlays/><Toaster position="bottom-right" richColors/></>;}
function Index(){return <StoreProvider><Experience/></StoreProvider>;}
