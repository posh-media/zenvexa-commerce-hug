import {createFileRoute} from '@tanstack/react-router';
import {StoreProvider} from '@/components/zenvexa/store-context';
import {AdminGate} from '@/components/zenvexa/admin';
import {Toaster} from '@/components/ui/sonner';
export const Route=createFileRoute('/admin')({
 head:()=>({meta:[{title:'Admin Portal — Zenvexa Commerce Hug'},{name:'description',content:'Manage Zenvexa products, inventory, orders and dispatch.'},{name:'robots',content:'noindex'},{property:'og:title',content:'Zenvexa Admin Portal'},{property:'og:description',content:'Staff-only operations portal for Zenvexa Commerce Hug.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:()=> <StoreProvider><AdminGate/><Toaster position="bottom-right" richColors/></StoreProvider>,
});
