import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./utils-D4bLmd5U.js";import{t as n}from"./currency-input-Cr9dZceK.js";var r=e();function i({name:e,value:i,defaultValue:a,onChange:o,currency:s=`COP`,autoFocus:c,className:l}){return(0,r.jsxs)(`div`,{className:t(`flex flex-col items-center gap-1`,l),children:[(0,r.jsx)(`span`,{className:`text-sm text-muted-foreground`,children:s}),(0,r.jsx)(n,{name:e,value:i,defaultValue:a,onChange:o,autoFocus:c,placeholder:`0`,className:t(`border-none bg-transparent text-center shadow-none`,`text-[32px] font-extrabold tracking-tight`,`h-auto py-2`,`focus-visible:ring-0 focus-visible:border-none`,`placeholder:text-muted-foreground/30`)})]})}i.__docgenInfo={description:``,methods:[],displayName:`AmountInput`,props:{name:{required:!1,tsType:{name:`string`},description:``},value:{required:!1,tsType:{name:`union`,raw:`string | number`,elements:[{name:`string`},{name:`number`}]},description:``},defaultValue:{required:!1,tsType:{name:`union`,raw:`string | number`,elements:[{name:`string`},{name:`number`}]},description:``},onChange:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(e: React.ChangeEvent<HTMLInputElement>) => void`,signature:{arguments:[{type:{name:`ReactChangeEvent`,raw:`React.ChangeEvent<HTMLInputElement>`,elements:[{name:`HTMLInputElement`}]},name:`e`}],return:{name:`void`}}},description:``},currency:{required:!1,tsType:{name:`string`},description:``,defaultValue:{value:`"COP"`,computed:!1}},autoFocus:{required:!1,tsType:{name:`boolean`},description:``},className:{required:!1,tsType:{name:`string`},description:``}}};var a={title:`UI/AmountInput`,component:i,tags:[`autodocs`],decorators:[e=>(0,r.jsx)(`div`,{className:`flex justify-center p-8`,children:(0,r.jsx)(e,{})})]},o={args:{currency:`COP`}},s={args:{currency:`COP`,value:15e5}},c={args:{currency:`USD`,value:250}},l={args:{currency:`EUR`,defaultValue:100}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    currency: "COP"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    currency: "COP",
    value: 1500000
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    currency: "USD",
    value: 250
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    currency: "EUR",
    defaultValue: 100
  }
}`,...l.parameters?.docs?.source}}};var u=[`Default`,`WithValue`,`USD`,`EUR`];export{o as Default,l as EUR,c as USD,s as WithValue,u as __namedExportsOrder,a as default};