import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./createLucideIcon-BPPJvB0G.js";import{t as n}from"./toggle-Z57KSHav.js";var r=t(`bold`,[[`path`,{d:`M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8`,key:`mg9rjx`}]]),i=t(`italic`,[[`line`,{x1:`19`,x2:`10`,y1:`4`,y2:`4`,key:`15jd3p`}],[`line`,{x1:`14`,x2:`5`,y1:`20`,y2:`20`,key:`bu0au3`}],[`line`,{x1:`15`,x2:`9`,y1:`4`,y2:`20`,key:`uljnxc`}]]),a=t(`underline`,[[`path`,{d:`M6 4v6a6 6 0 0 0 12 0V4`,key:`9kb039`}],[`line`,{x1:`4`,x2:`20`,y1:`20`,y2:`20`,key:`nun2al`}]]),o=e(),s={title:`UI/Toggle`,component:n,tags:[`autodocs`],argTypes:{variant:{control:`select`,options:[`default`,`outline`]},size:{control:`select`,options:[`sm`,`default`,`lg`]}}},c={args:{children:`Activo`,"aria-label":`Alternar`}},l={args:{variant:`outline`,children:`Filtro`,"aria-label":`Alternar filtro`}},u={args:{variant:`outline`,"aria-label":`Negrita`,children:(0,o.jsx)(r,{className:`size-4`})}},d={args:{defaultPressed:!0,children:`Seleccionado`,"aria-label":`Alternar selección`}},f={args:{disabled:!0,children:`Deshabilitado`,"aria-label":`Deshabilitado`}},p={render:()=>(0,o.jsxs)(`div`,{className:`flex gap-1`,children:[(0,o.jsx)(n,{"aria-label":`Negrita`,variant:`outline`,children:(0,o.jsx)(r,{className:`size-4`})}),(0,o.jsx)(n,{"aria-label":`Cursiva`,variant:`outline`,children:(0,o.jsx)(i,{className:`size-4`})}),(0,o.jsx)(n,{"aria-label":`Subrayado`,variant:`outline`,children:(0,o.jsx)(a,{className:`size-4`})})]})};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    children: "Activo",
    "aria-label": "Alternar"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "outline",
    children: "Filtro",
    "aria-label": "Alternar filtro"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "outline",
    "aria-label": "Negrita",
    children: <Bold className="size-4" />
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    defaultPressed: true,
    children: "Seleccionado",
    "aria-label": "Alternar selección"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    children: "Deshabilitado",
    "aria-label": "Deshabilitado"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex gap-1">
      <Toggle aria-label="Negrita" variant="outline">
        <Bold className="size-4" />
      </Toggle>
      <Toggle aria-label="Cursiva" variant="outline">
        <Italic className="size-4" />
      </Toggle>
      <Toggle aria-label="Subrayado" variant="outline">
        <Underline className="size-4" />
      </Toggle>
    </div>
}`,...p.parameters?.docs?.source}}};var m=[`Default`,`Outline`,`WithIcon`,`Pressed`,`Disabled`,`FormattingGroup`];export{c as Default,f as Disabled,p as FormattingGroup,l as Outline,d as Pressed,u as WithIcon,m as __namedExportsOrder,s as default};