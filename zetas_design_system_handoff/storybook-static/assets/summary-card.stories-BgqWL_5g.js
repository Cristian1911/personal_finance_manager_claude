import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./utils-D4bLmd5U.js";import{t as n}from"./stat-card-mk3tHkSz.js";var r=e();function i({label:e=`Resumen del período`,metrics:i,className:a}){return(0,r.jsxs)(`div`,{className:t(`rounded-2xl border border-white/6 bg-z-surface-2/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`,a),children:[(0,r.jsx)(`p`,{className:`text-[10px] font-semibold uppercase tracking-[0.18em] text-z-olive-deep`,children:e}),(0,r.jsx)(`div`,{className:`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3`,children:i.map(e=>(0,r.jsx)(n,{label:e.label,value:e.value,context:e.context},e.label))})]})}i.__docgenInfo={description:``,methods:[],displayName:`SummaryCard`,props:{label:{required:!1,tsType:{name:`string`},description:``,defaultValue:{value:`"Resumen del período"`,computed:!1}},metrics:{required:!0,tsType:{name:`tuple`,raw:`[SummaryMetric, SummaryMetric, SummaryMetric]`,elements:[{name:`SummaryMetric`},{name:`SummaryMetric`},{name:`SummaryMetric`}]},description:``},className:{required:!1,tsType:{name:`string`},description:``}}};var a={title:`UI/SummaryCard`,component:i,tags:[`autodocs`],decorators:[e=>(0,r.jsx)(`div`,{className:`w-full max-w-2xl p-4`,children:(0,r.jsx)(e,{})})]},o={args:{label:`Resumen del período`,metrics:[{label:`Ingresos`,value:`$4,800,000`,context:`3 fuentes`},{label:`Gastos`,value:`$2,340,000`,context:`48% del ingreso`},{label:`Ahorro`,value:`$2,460,000`,context:`Meta: $3,000,000`}]}},s={args:{label:`Presupuesto 50/30/20`,metrics:[{label:`Necesidades`,value:`$2,400,000`,context:`50% — en meta`},{label:`Gustos`,value:`$1,440,000`,context:`30% — en meta`},{label:`Ahorro`,value:`$960,000`,context:`20% — en meta`}]}},c={args:{label:`Estado actual`,metrics:[{label:`Necesidades`,value:`$2,900,000`,context:`60% — excedido`},{label:`Gustos`,value:`$800,000`,context:`16% — bajo`},{label:`Ahorro`,value:`$1,100,000`,context:`22% — en meta`}]}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Resumen del período",
    metrics: [{
      label: "Ingresos",
      value: "$4,800,000",
      context: "3 fuentes"
    }, {
      label: "Gastos",
      value: "$2,340,000",
      context: "48% del ingreso"
    }, {
      label: "Ahorro",
      value: "$2,460,000",
      context: "Meta: $3,000,000"
    }]
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Presupuesto 50/30/20",
    metrics: [{
      label: "Necesidades",
      value: "$2,400,000",
      context: "50% — en meta"
    }, {
      label: "Gustos",
      value: "$1,440,000",
      context: "30% — en meta"
    }, {
      label: "Ahorro",
      value: "$960,000",
      context: "20% — en meta"
    }]
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Estado actual",
    metrics: [{
      label: "Necesidades",
      value: "$2,900,000",
      context: "60% — excedido"
    }, {
      label: "Gustos",
      value: "$800,000",
      context: "16% — bajo"
    }, {
      label: "Ahorro",
      value: "$1,100,000",
      context: "22% — en meta"
    }]
  }
}`,...c.parameters?.docs?.source}}};var l=[`Default`,`BudgetSummary`,`OverBudget`];export{s as BudgetSummary,o as Default,c as OverBudget,l as __namedExportsOrder,a as default};