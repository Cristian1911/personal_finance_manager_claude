import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./checkbox-B4DSFFXh.js";import{t as n}from"./label-C-NmWOXn.js";import{t as r}from"./input-Daf6xfvE.js";var i=e(),a={title:`UI/Label`,component:n,tags:[`autodocs`]},o={args:{children:`Categoría`}},s={render:()=>(0,i.jsxs)(`div`,{className:`grid gap-2`,children:[(0,i.jsx)(n,{htmlFor:`email`,children:`Correo electrónico`}),(0,i.jsx)(r,{id:`email`,type:`email`,placeholder:`tu@correo.com`})]})},c={render:()=>(0,i.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,i.jsx)(t,{id:`include`}),(0,i.jsx)(n,{htmlFor:`include`,children:`Incluir transacciones pendientes`})]})};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    children: "Categoría"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <div className="grid gap-2">
      <Label htmlFor="email">Correo electrónico</Label>
      <Input id="email" type="email" placeholder="tu@correo.com" />
    </div>
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-2">
      <Checkbox id="include" />
      <Label htmlFor="include">Incluir transacciones pendientes</Label>
    </div>
}`,...c.parameters?.docs?.source}}};var l=[`Default`,`WithInput`,`WithCheckbox`];export{o as Default,c as WithCheckbox,s as WithInput,l as __namedExportsOrder,a as default};