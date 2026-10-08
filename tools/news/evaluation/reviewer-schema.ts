/** Compiles the unchanged A1 annotation vocabulary for browser-only validation; no runtime dependencies/network. */
import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import standaloneCode from 'ajv/dist/standalone/index.js'
export function reviewerSchemaAssets() {
  const schema=JSON.parse(readFileSync(new URL('./schema.json',import.meta.url),'utf8'))
  const annotation=schema.properties.review.properties.annotations.items
  const ajv=new Ajv({allErrors:true,strict:false,validateFormats:false,code:{source:true}})
  const validate=ajv.compile({$defs:schema.$defs,...annotation})
  let code=standaloneCode(ajv,validate)
  code=code.replace(/require\("ajv\/dist\/runtime\/ucs2length"\)/g,'({default:s=>Array.from(s).length})')
  code=code.replace(/require\("ajv\/dist\/runtime\/equal"\)/g,`({default:function equal(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&equal(a[k],b[k]))}})`)
  if(code.includes('require('))throw Error('Unexpected browser schema dependency')
  const props=schema.$defs.labels.properties
  const vocabulary={subjects:props.primarySubject.enum.filter((s:unknown)=>s!==null&&s!=='not_applicable'),contentTypes:props.contentType.enum.filter(Boolean),scopes:props.scope.enum.filter(Boolean),rejectReasons:props.rejectReasons.items.enum,missingFields:props.metadataSufficiency.anyOf[0].properties.missingFields.items.enum,novelty:props.novelty.anyOf[0].properties.status.enum}
  return {validator:`const validateAnnotationShape=(()=>{const module={exports:{}};${code};return module.exports})()`,vocabulary,completion:schema.allOf[0].then.properties.gold.properties}
}
