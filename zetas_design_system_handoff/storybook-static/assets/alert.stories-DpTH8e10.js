import"./chunk-DseTPa7n.js";import{t as e}from"./react-CIi_Xeu6.js";import{t}from"./jsx-runtime-Ds4jeNO1.js";import{t as n}from"./createLucideIcon-BPPJvB0G.js";import{t as r}from"./circle-check-Cs-jSUQO.js";import{t as i}from"./info-BfH0xKyR.js";import{t as a}from"./triangle-alert-BSJDwESj.js";import{t as o}from"./utils-D4bLmd5U.js";import{t as s}from"./dist-CpANFHlD.js";var c=n(`circle-alert`,[[`circle`,{cx:`12`,cy:`12`,r:`10`,key:`1mglay`}],[`line`,{x1:`12`,x2:`12`,y1:`8`,y2:`12`,key:`1pkeuh`}],[`line`,{x1:`12`,x2:`12.01`,y1:`16`,y2:`16`,key:`4dfq90`}]]);e();var l=t(),u=s(`relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current`,{variants:{variant:{default:`bg-card text-card-foreground`,destructive:`text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90`}},defaultVariants:{variant:`default`}});function d({className:e,variant:t,...n}){return(0,l.jsx)(`div`,{"data-slot":`alert`,role:`alert`,className:o(u({variant:t}),e),...n})}function f({className:e,...t}){return(0,l.jsx)(`div`,{"data-slot":`alert-title`,className:o(`col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight`,e),...t})}function p({className:e,...t}){return(0,l.jsx)(`div`,{"data-slot":`alert-description`,className:o(`text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed`,e),...t})}d.__docgenInfo={description:``,methods:[],displayName:`Alert`},f.__docgenInfo={description:``,methods:[],displayName:`AlertTitle`},p.__docgenInfo={description:``,methods:[],displayName:`AlertDescription`};var m={title:`UI/Alert`,component:d,tags:[`autodocs`],argTypes:{variant:{control:`select`,options:[`default`,`destructive`]}}},h={render:e=>(0,l.jsxs)(d,{...e,children:[(0,l.jsx)(i,{className:`size-4`}),(0,l.jsx)(f,{children:`Información`}),(0,l.jsx)(p,{children:`Tu saldo ha sido actualizado correctamente.`})]}),args:{variant:`default`}},g={render:e=>(0,l.jsxs)(d,{...e,children:[(0,l.jsx)(c,{className:`size-4`}),(0,l.jsx)(f,{children:`Error al importar`}),(0,l.jsx)(p,{children:`No se pudo procesar el extracto. Verifica que el archivo sea válido.`})]}),args:{variant:`destructive`}},_={render:e=>(0,l.jsxs)(d,{...e,children:[(0,l.jsx)(f,{children:`Presupuesto excedido`}),(0,l.jsx)(p,{children:`Has gastado más del 80% de tu presupuesto de ocio este mes.`})]}),args:{variant:`default`}},v={render:e=>(0,l.jsxs)(d,{...e,children:[(0,l.jsx)(r,{className:`size-4`}),(0,l.jsx)(f,{children:`Importación exitosa`}),(0,l.jsx)(p,{children:`Se importaron 42 transacciones sin errores.`})]}),args:{variant:`default`}},y={render:e=>(0,l.jsxs)(d,{...e,children:[(0,l.jsx)(a,{className:`size-4`}),(0,l.jsx)(f,{children:`Revisa tus gastos`}),(0,l.jsx)(p,{children:`3 transacciones están sin categorizar este mes.`})]}),args:{variant:`default`}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  render: args => <Alert {...args}>
      <Info className="size-4" />
      <AlertTitle>Información</AlertTitle>
      <AlertDescription>
        Tu saldo ha sido actualizado correctamente.
      </AlertDescription>
    </Alert>,
  args: {
    variant: "default"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: args => <Alert {...args}>
      <AlertCircle className="size-4" />
      <AlertTitle>Error al importar</AlertTitle>
      <AlertDescription>
        No se pudo procesar el extracto. Verifica que el archivo sea válido.
      </AlertDescription>
    </Alert>,
  args: {
    variant: "destructive"
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  render: args => <Alert {...args}>
      <AlertTitle>Presupuesto excedido</AlertTitle>
      <AlertDescription>
        Has gastado más del 80% de tu presupuesto de ocio este mes.
      </AlertDescription>
    </Alert>,
  args: {
    variant: "default"
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  render: args => <Alert {...args}>
      <CheckCircle2 className="size-4" />
      <AlertTitle>Importación exitosa</AlertTitle>
      <AlertDescription>
        Se importaron 42 transacciones sin errores.
      </AlertDescription>
    </Alert>,
  args: {
    variant: "default"
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  render: args => <Alert {...args}>
      <AlertTriangle className="size-4" />
      <AlertTitle>Revisa tus gastos</AlertTitle>
      <AlertDescription>
        3 transacciones están sin categorizar este mes.
      </AlertDescription>
    </Alert>,
  args: {
    variant: "default"
  }
}`,...y.parameters?.docs?.source}}};var b=[`Default`,`Destructive`,`WithoutIcon`,`Success`,`Warning`];export{h as Default,g as Destructive,v as Success,y as Warning,_ as WithoutIcon,b as __namedExportsOrder,m as default};