import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const url='https://websiteoss.ecoflow.com/media/delta2/pc/8ffbd023f0fdc44f69f8ed08387f99e1.jpg';
const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Manufacturer reference image unavailable.');
const bytes=Buffer.from(await response.arrayBuffer());const metadata=await sharp(bytes).metadata();
await sharp(bytes).resize({width:800,withoutEnlargement:true}).webp({quality:90}).toFile('public/catalog/eco.webp');
await writeFile('catalogue-image-sources.json',JSON.stringify({eco:{sourcePage:'https://www.ecoflow.com/us/delta-2-portable-power-station',image:url,width:metadata.width,height:metadata.height,review:'Manufacturer DELTA 2 reference; verify stock regional variant and usage rights before production publication.'}},null,2));
console.log(JSON.stringify({id:'eco',status:response.status,width:metadata.width,height:metadata.height}));
