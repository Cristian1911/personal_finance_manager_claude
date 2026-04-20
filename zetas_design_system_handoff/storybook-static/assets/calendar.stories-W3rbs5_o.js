import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./calendar-Bvu4Mbw5.js";var n=e(),r={title:`UI/Calendar`,component:t,tags:[`autodocs`],decorators:[e=>(0,n.jsx)(`div`,{className:`flex justify-center p-4`,children:(0,n.jsx)(e,{})})]},i={args:{mode:`single`,selected:new Date(`2026-04-01`)}},a={args:{mode:`range`,selected:{from:new Date(`2026-04-01`),to:new Date(`2026-04-15`)}}},o={args:{mode:`single`,captionLayout:`dropdown`,selected:new Date}},s={args:{mode:`single`,showOutsideDays:!1,selected:new Date}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "single",
    selected: new Date("2026-04-01")
  }
}`,...i.parameters?.docs?.source}}},a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "range",
    selected: {
      from: new Date("2026-04-01"),
      to: new Date("2026-04-15")
    }
  }
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "single",
    captionLayout: "dropdown",
    selected: new Date()
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    mode: "single",
    showOutsideDays: false,
    selected: new Date()
  }
}`,...s.parameters?.docs?.source}}};var c=[`Default`,`Range`,`WithDropdown`,`NoOutsideDays`];export{i as Default,s as NoOutsideDays,a as Range,o as WithDropdown,c as __namedExportsOrder,r as default};