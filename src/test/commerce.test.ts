import {describe,it,expect} from 'vitest';
import {products,locations,promoDiscount,cartSubtotal,orderTotal,money} from '@/lib/commerce';
describe('Nigerian commerce rules',()=>{
 it('HUG10 takes ten percent off merchandise',()=>{expect(promoDiscount('HUG10',985000)).toBe(98500);});
 it('NAIJA5K takes ₦5,000 off orders above ₦50,000',()=>{expect(promoDiscount('NAIJA5K',50001)).toBe(5000);expect(promoDiscount('NAIJA5K',50000)).toBe(0);expect(promoDiscount('NAIJA5K',49500)).toBe(0);});
 it('calculates quantity subtotal, discount and selected delivery',()=>{const cart=[{product:products[2],quantity:2}];expect(cartSubtotal(cart)).toBe(157000);expect(orderTotal(cart,'Lagos','HUG10')).toBe(142800);expect(orderTotal(cart,'Kano','HUG10')).toBe(144500);expect(orderTotal([],'Lagos')).toBe(0);});
 it('keeps all twelve requested selling and old prices',()=>{expect(products.map(p=>[p.price,p.oldPrice])).toEqual([[985000,1120000],[545000,590000],[78500,85000],[94000,110000],[42000,52000],[36500,44000],[88000,105000],[28500,34000],[890000,970000],[19500,22000],[65000,78000],[46000,55000]]);});
 it('uses Nigerian Naira with no decimal places',()=>{expect(money(985000)).toBe('₦985,000');});
 it('sets Nigerian delivery fees within ₦1,500–₦3,200',()=>{expect(Object.keys(locations)).toEqual(['Lagos','Abuja (FCT)','Rivers','Oyo','Kano','Enugu']);expect(Math.min(...Object.values(locations).map(l=>l.fee))).toBe(1500);expect(Math.max(...Object.values(locations).map(l=>l.fee))).toBe(3200);});
});
