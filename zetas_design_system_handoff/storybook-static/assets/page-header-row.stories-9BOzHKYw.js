import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./download-DLKd8eRb.js";import{t as n}from"./plus-BX6mmboI.js";import{t as r}from"./utils-D4bLmd5U.js";import{t as i}from"./button-CNP2-gLS.js";var a=e();function o({title:e,subtitle:t,actions:n,className:i}){return(0,a.jsxs)(`div`,{className:r(`flex flex-wrap items-end justify-between gap-3`,i),children:[(0,a.jsxs)(`div`,{className:`min-w-0`,children:[(0,a.jsx)(`h1`,{className:`text-[22px] font-bold tracking-tight`,children:e}),t&&(0,a.jsx)(`p`,{className:`mt-0.5 text-sm text-muted-foreground`,children:t})]}),n&&(0,a.jsx)(`div`,{className:`flex flex-shrink-0 flex-wrap items-center gap-3`,children:n})]})}o.__docgenInfo={description:``,methods:[],displayName:`PageHeaderRow`,props:{title:{required:!0,tsType:{name:`string`},description:``},subtitle:{required:!1,tsType:{name:`string`},description:``},actions:{required:!1,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},className:{required:!1,tsType:{name:`string`},description:``}}};var s={title:`UI/PageHeaderRow`,component:o,tags:[`autodocs`],decorators:[e=>(0,a.jsx)(`div`,{className:`p-6`,children:(0,a.jsx)(e,{})})]},c={args:{title:`Transacciones`,subtitle:`Abril 2026`}},l={args:{title:`Presupuesto`,subtitle:`Gestiona tu asignación 50/30/20`,actions:(0,a.jsxs)(a.Fragment,{children:[(0,a.jsxs)(i,{variant:`outline`,size:`sm`,children:[(0,a.jsx)(t,{className:`size-4`}),`Exportar`]}),(0,a.jsxs)(i,{size:`sm`,children:[(0,a.jsx)(n,{className:`size-4`}),`Nueva categoría`]})]})}},u={args:{title:`Cuentas bancarias`}},d={args:{title:`Historial de transacciones importadas`,subtitle:`Extractos procesados desde enero 2026`}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Transacciones",
    subtitle: "Abril 2026"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Presupuesto",
    subtitle: "Gestiona tu asignación 50/30/20",
    actions: <>
        <Button variant="outline" size="sm">
          <Download className="size-4" />
          Exportar
        </Button>
        <Button size="sm">
          <Plus className="size-4" />
          Nueva categoría
        </Button>
      </>
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Cuentas bancarias"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Historial de transacciones importadas",
    subtitle: "Extractos procesados desde enero 2026"
  }
}`,...d.parameters?.docs?.source}}};var f=[`Default`,`WithActions`,`TitleOnly`,`LongTitle`];export{c as Default,d as LongTitle,u as TitleOnly,l as WithActions,f as __namedExportsOrder,s as default};