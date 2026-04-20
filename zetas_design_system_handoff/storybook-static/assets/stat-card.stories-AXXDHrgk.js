import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{n as t,t as n}from"./stat-card-mk3tHkSz.js";var r=e(),i={title:`UI/CompactMetricBox`,component:n,tags:[`autodocs`],decorators:[e=>(0,r.jsx)(`div`,{className:`w-48 p-4`,children:(0,r.jsx)(e,{})})]},a={args:{label:`Presupuesto`,value:`$2,400,000`,context:`4 fuentes`}},o={args:{label:`Gastos del mes`,value:(0,r.jsx)(`span`,{className:`text-red-400`,children:`$1,847,200`}),context:`21% del ingreso`}},s={args:{label:`Saldo disponible`,value:`$1,200,000`}},c={render:()=>(0,r.jsx)(`div`,{className:`w-48 p-4`,children:(0,r.jsx)(t,{label:`Total deudas`,value:`$12,500,000`,description:`2 créditos activos`})})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Presupuesto",
    value: "$2,400,000",
    context: "4 fuentes"
  }
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Gastos del mes",
    value: <span className="text-red-400">$1,847,200</span>,
    context: "21% del ingreso"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Saldo disponible",
    value: "$1,200,000"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-48 p-4">
      <StatCard label="Total deudas" value="$12,500,000" description="2 créditos activos" />
    </div>
}`,...c.parameters?.docs?.source}}};var l=[`Default`,`Expense`,`NoContext`,`StatCardDefault`];export{a as Default,o as Expense,s as NoContext,c as StatCardDefault,l as __namedExportsOrder,i as default};