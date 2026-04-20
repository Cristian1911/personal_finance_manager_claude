import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./createLucideIcon-BPPJvB0G.js";import{t as n}from"./credit-card-Dx4qEFPe.js";import{t as r}from"./utils-D4bLmd5U.js";var i=t(`trending-down`,[[`path`,{d:`M16 17h6v-6`,key:`t6n2it`}],[`path`,{d:`m22 17-8.5-8.5-5 5L2 7`,key:`x473p`}]]),a=t(`trending-up`,[[`path`,{d:`M16 7h6v6`,key:`box55l`}],[`path`,{d:`m22 7-8.5 8.5-5-5L2 17`,key:`1t1m79`}]]),o=t(`wallet`,[[`path`,{d:`M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1`,key:`18etb6`}],[`path`,{d:`M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4`,key:`xoc0q4`}]]),s=e(),c={income:{icon:`bg-z-income/10 text-z-income`,trend:{up:`text-z-income`,down:`text-z-debt`,flat:`text-muted-foreground`}},expense:{icon:`bg-z-expense/10 text-z-expense`,trend:{up:`text-z-debt`,down:`text-z-income`,flat:`text-muted-foreground`}},debt:{icon:`bg-z-debt/10 text-z-debt`,trend:{up:`text-z-debt`,down:`text-z-income`,flat:`text-muted-foreground`}},alert:{icon:`bg-z-alert/10 text-z-alert`,trend:{up:`text-z-alert`,down:`text-z-income`,flat:`text-muted-foreground`}},neutral:{icon:`bg-muted text-muted-foreground`,trend:{up:`text-z-income`,down:`text-z-debt`,flat:`text-muted-foreground`}}};function l({label:e,value:t,trend:n,icon:i,semanticColor:a=`neutral`,className:o}){let l=c[a],u=n?l.trend[n.direction]??`text-muted-foreground`:``,d=n?.direction===`up`?`↑`:n?.direction===`down`?`↓`:`→`;return(0,s.jsxs)(`div`,{className:r(`flex items-start justify-between rounded-[14px] bg-z-surface-2 p-4`,o),children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{className:`text-[11px] text-muted-foreground`,children:e}),(0,s.jsx)(`p`,{className:`mt-1 text-[22px] font-extrabold leading-tight tracking-tight`,children:t}),n&&(0,s.jsxs)(`p`,{className:r(`mt-0.5 text-[11px]`,u),children:[d,` `,n.text]})]}),i&&(0,s.jsx)(`div`,{className:r(`flex size-9 shrink-0 items-center justify-center rounded-[10px]`,l.icon),children:i})]})}l.__docgenInfo={description:``,methods:[],displayName:`KPIWidget`,props:{label:{required:!0,tsType:{name:`string`},description:``},value:{required:!0,tsType:{name:`string`},description:``},trend:{required:!1,tsType:{name:`signature`,type:`object`,raw:`{ direction: "up" | "down" | "flat"; text: string }`,signature:{properties:[{key:`direction`,value:{name:`union`,raw:`"up" | "down" | "flat"`,elements:[{name:`literal`,value:`"up"`},{name:`literal`,value:`"down"`},{name:`literal`,value:`"flat"`}],required:!0}},{key:`text`,value:{name:`string`,required:!0}}]}},description:``},icon:{required:!1,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},semanticColor:{required:!1,tsType:{name:`union`,raw:`"income" | "expense" | "debt" | "alert" | "neutral"`,elements:[{name:`literal`,value:`"income"`},{name:`literal`,value:`"expense"`},{name:`literal`,value:`"debt"`},{name:`literal`,value:`"alert"`},{name:`literal`,value:`"neutral"`}]},description:``,defaultValue:{value:`"neutral"`,computed:!1}},className:{required:!1,tsType:{name:`string`},description:``}}};var u={title:`UI/KPIWidget`,component:l,tags:[`autodocs`],argTypes:{semanticColor:{control:`select`,options:[`income`,`expense`,`debt`,`alert`,`neutral`]}},decorators:[e=>(0,s.jsx)(`div`,{className:`w-64 p-4`,children:(0,s.jsx)(e,{})})]},d={args:{label:`Ingresos del mes`,value:`$4,800,000`,semanticColor:`income`,icon:(0,s.jsx)(o,{className:`size-5`}),trend:{direction:`up`,text:`+12% vs mes anterior`}}},f={args:{label:`Gastos totales`,value:`$2,340,000`,semanticColor:`expense`,icon:(0,s.jsx)(n,{className:`size-5`}),trend:{direction:`down`,text:`-5% vs mes anterior`}}},p={args:{label:`Deuda activa`,value:`$12,500,000`,semanticColor:`debt`,icon:(0,s.jsx)(i,{className:`size-5`}),trend:{direction:`down`,text:`Pagando $450,000/mes`}}},m={args:{label:`Presupuesto excedido`,value:`3 categorías`,semanticColor:`alert`,trend:{direction:`up`,text:`Revisar urgente`}}},h={args:{label:`Saldo total`,value:`$8,200,000`,semanticColor:`neutral`,icon:(0,s.jsx)(a,{className:`size-5`})}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Ingresos del mes",
    value: "$4,800,000",
    semanticColor: "income",
    icon: <Wallet className="size-5" />,
    trend: {
      direction: "up",
      text: "+12% vs mes anterior"
    }
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Gastos totales",
    value: "$2,340,000",
    semanticColor: "expense",
    icon: <CreditCard className="size-5" />,
    trend: {
      direction: "down",
      text: "-5% vs mes anterior"
    }
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Deuda activa",
    value: "$12,500,000",
    semanticColor: "debt",
    icon: <TrendingDown className="size-5" />,
    trend: {
      direction: "down",
      text: "Pagando $450,000/mes"
    }
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Presupuesto excedido",
    value: "3 categorías",
    semanticColor: "alert",
    trend: {
      direction: "up",
      text: "Revisar urgente"
    }
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Saldo total",
    value: "$8,200,000",
    semanticColor: "neutral",
    icon: <TrendingUp className="size-5" />
  }
}`,...h.parameters?.docs?.source}}};var g=[`Income`,`Expense`,`Debt`,`Alert`,`NoTrend`];export{m as Alert,p as Debt,f as Expense,d as Income,h as NoTrend,g as __namedExportsOrder,u as default};