import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./circle-check-Cs-jSUQO.js";import{t as n}from"./utils-D4bLmd5U.js";import{t as r}from"./next-link-d5Y_CuH8.js";var i=e();function a({signals:e,className:a}){let o=e.length>0;return(0,i.jsxs)(`div`,{className:n(`rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`,o?`border-z-brass/20 bg-z-surface-2/80`:`border-z-olive-deep/25 bg-z-surface-2/80`,a),children:[(0,i.jsx)(`p`,{className:n(`text-[10px] font-semibold uppercase tracking-[0.18em]`,o?`text-z-brass`:`text-z-olive-deep`),children:o?`Necesita atención`:`Estado`}),o?(0,i.jsx)(`div`,{className:`mt-3 space-y-2`,children:e.map(e=>(0,i.jsxs)(`div`,{className:`flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2`,children:[(0,i.jsxs)(`div`,{className:`flex min-w-0 items-center gap-2`,children:[(0,i.jsx)(`span`,{className:`flex h-5 min-w-5 items-center justify-center rounded-full bg-z-brass/15 text-[10px] font-bold text-z-brass`,children:e.count}),(0,i.jsx)(`span`,{className:`truncate text-sm`,children:e.label})]}),(0,i.jsx)(r,{href:e.actionHref,className:`flex-shrink-0 text-xs font-medium text-z-brass hover:text-z-brass/80`,children:`Resolver →`})]},e.key))}):(0,i.jsxs)(r,{href:`/dashboard`,className:`mt-3 flex items-center gap-2 group`,children:[(0,i.jsx)(t,{className:`size-4 text-z-olive-deep`}),(0,i.jsx)(`span`,{className:`text-sm font-medium text-z-olive-deep group-hover:text-z-olive-deep/80`,children:`Al día`})]})]})}a.__docgenInfo={description:``,methods:[],displayName:`AttentionCard`,props:{signals:{required:!0,tsType:{name:`Array`,elements:[{name:`signature`,type:`object`,raw:`{
  page: AttentionPage;
  key: string;
  count: number;
  label: string;
  priority: AttentionPriority;
  actionHref: string;
}`,signature:{properties:[{key:`page`,value:{name:`union`,raw:`"transactions" | "categories" | "destinatarios" | "recurrentes" | "pendientes"`,elements:[{name:`literal`,value:`"transactions"`},{name:`literal`,value:`"categories"`},{name:`literal`,value:`"destinatarios"`},{name:`literal`,value:`"recurrentes"`},{name:`literal`,value:`"pendientes"`}],required:!0}},{key:`key`,value:{name:`string`,required:!0}},{key:`count`,value:{name:`number`,required:!0}},{key:`label`,value:{name:`string`,required:!0}},{key:`priority`,value:{name:`union`,raw:`"action" | "suggestion"`,elements:[{name:`literal`,value:`"action"`},{name:`literal`,value:`"suggestion"`}],required:!0}},{key:`actionHref`,value:{name:`string`,required:!0}}]}}],raw:`AttentionSignal[]`},description:``},className:{required:!1,tsType:{name:`string`},description:``}}};var o={title:`UI/AttentionCard`,component:a,tags:[`autodocs`],decorators:[e=>(0,i.jsx)(`div`,{className:`w-96 rounded-2xl bg-z-surface p-4`,children:(0,i.jsx)(e,{})})]},s={args:{signals:[]}},c={args:{signals:[{key:`uncategorized`,label:`Transacciones sin categorizar`,count:5,actionHref:`/transactions`,page:`transactions`,priority:`action`},{key:`budget-over`,label:`Presupuestos excedidos`,count:2,actionHref:`/categories`,page:`categories`,priority:`action`}]}},l={args:{signals:[{key:`uncategorized`,label:`Transacciones sin categorizar`,count:12,actionHref:`/transactions`,page:`transactions`,priority:`action`}]}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    signals: []
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    signals: [{
      key: "uncategorized",
      label: "Transacciones sin categorizar",
      count: 5,
      actionHref: "/transactions",
      page: "transactions" as const,
      priority: "action" as const
    }, {
      key: "budget-over",
      label: "Presupuestos excedidos",
      count: 2,
      actionHref: "/categories",
      page: "categories" as const,
      priority: "action" as const
    }]
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    signals: [{
      key: "uncategorized",
      label: "Transacciones sin categorizar",
      count: 12,
      actionHref: "/transactions",
      page: "transactions" as const,
      priority: "action" as const
    }]
  }
}`,...l.parameters?.docs?.source}}};var u=[`AllGood`,`WithSignals`,`SingleSignal`];export{s as AllGood,l as SingleSignal,c as WithSignals,u as __namedExportsOrder,o as default};