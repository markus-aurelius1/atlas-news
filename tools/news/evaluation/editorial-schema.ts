import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import { instant, requireThat, urlIdentity } from './core.ts'
const ajv=new Ajv({strict:false,allErrors:true})
ajv.addFormat('utc-instant',{type:'string',validate:value=>{try{instant(value);return true}catch{return false}}})
ajv.addFormat('article-url',{type:'string',validate:value=>{try{return urlIdentity(value)===value}catch{return false}}})
const output=ajv.compile(JSON.parse(readFileSync(new URL('./editorial-output-schema.json',import.meta.url),'utf8')))
const judgment=ajv.compile(JSON.parse(readFileSync(new URL('./editorial-judgment-schema.json',import.meta.url),'utf8')))
export function checkEditorialOutputSchema(value:unknown){requireThat(output(value),'Editorial output schema violation: '+(output.errors??[]).map(e=>e.instancePath+' '+e.keyword).join(', '))}
export function checkEditorialJudgmentSchema(value:unknown){requireThat(judgment(value),'Editorial judgment schema violation: '+(judgment.errors??[]).map(e=>e.instancePath+' '+e.keyword).join(', '))}
