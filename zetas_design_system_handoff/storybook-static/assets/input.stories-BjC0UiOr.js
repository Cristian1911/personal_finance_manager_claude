import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./search-CP0hRhZ6.js";import{t as n}from"./input-Daf6xfvE.js";var r=e(),i={title:`UI/Input`,component:n,tags:[`autodocs`],decorators:[e=>(0,r.jsx)(`div`,{className:`w-64 p-4`,children:(0,r.jsx)(e,{})})]},a={args:{placeholder:`Buscar transacciones...`}},o={args:{defaultValue:`Supermercado Éxito`}},s={args:{placeholder:`No editable`,disabled:!0}},c={args:{type:`password`,placeholder:`Contraseña`}},l={args:{type:`number`,placeholder:`Monto en COP`}},u={args:{defaultValue:`valor-inválido`,"aria-invalid":!0}},d={render:()=>(0,r.jsxs)(`div`,{className:`relative w-64`,children:[(0,r.jsx)(t,{className:`absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground`}),(0,r.jsx)(n,{className:`pl-9`,placeholder:`Buscar...`})]})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: "Buscar transacciones..."
  }
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: "Supermercado Éxito"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: "No editable",
    disabled: true
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    type: "password",
    placeholder: "Contraseña"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    type: "number",
    placeholder: "Monto en COP"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: "valor-inválido",
    "aria-invalid": true
  } as React.ComponentProps<typeof Input>
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="relative w-64">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Buscar..." />
    </div>
}`,...d.parameters?.docs?.source}}};var f=[`Default`,`WithValue`,`Disabled`,`Password`,`Number`,`Invalid`,`WithIcon`];export{a as Default,s as Disabled,u as Invalid,l as Number,c as Password,d as WithIcon,o as WithValue,f as __namedExportsOrder,i as default};