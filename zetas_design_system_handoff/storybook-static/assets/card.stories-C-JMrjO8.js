import"./chunk-DseTPa7n.js";import{t as e}from"./react-CIi_Xeu6.js";import{t}from"./jsx-runtime-Ds4jeNO1.js";import{t as n}from"./utils-D4bLmd5U.js";import{t as r}from"./button-CNP2-gLS.js";e();var i=t();function a({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`card`,className:n(`bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm`,e),...t})}function o({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`card-header`,className:n(`@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6`,e),...t})}function s({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`card-title`,className:n(`leading-none font-semibold`,e),...t})}function c({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`card-description`,className:n(`text-muted-foreground text-sm`,e),...t})}function l({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`card-action`,className:n(`col-start-2 row-span-2 row-start-1 self-start justify-self-end`,e),...t})}function u({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`card-content`,className:n(`px-6`,e),...t})}function d({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`card-footer`,className:n(`flex items-center px-6 [.border-t]:pt-6`,e),...t})}a.__docgenInfo={description:``,methods:[],displayName:`Card`},o.__docgenInfo={description:``,methods:[],displayName:`CardHeader`},d.__docgenInfo={description:``,methods:[],displayName:`CardFooter`},s.__docgenInfo={description:``,methods:[],displayName:`CardTitle`},l.__docgenInfo={description:``,methods:[],displayName:`CardAction`},c.__docgenInfo={description:``,methods:[],displayName:`CardDescription`},u.__docgenInfo={description:``,methods:[],displayName:`CardContent`};var f={title:`UI/Card`,component:a,tags:[`autodocs`],decorators:[e=>(0,i.jsx)(`div`,{className:`w-96 p-4`,children:(0,i.jsx)(e,{})})]},p={render:()=>(0,i.jsxs)(a,{children:[(0,i.jsxs)(o,{children:[(0,i.jsx)(s,{children:`Resumen del mes`}),(0,i.jsx)(c,{children:`Abril 2026`})]}),(0,i.jsxs)(u,{children:[(0,i.jsx)(`p`,{className:`text-2xl font-bold`,children:`$4,800,000`}),(0,i.jsx)(`p`,{className:`text-sm text-muted-foreground`,children:`Ingresos totales`})]})]})},m={render:()=>(0,i.jsxs)(a,{children:[(0,i.jsxs)(o,{children:[(0,i.jsx)(s,{children:`Deuda activa`}),(0,i.jsx)(c,{children:`2 créditos pendientes`}),(0,i.jsx)(l,{children:(0,i.jsx)(r,{size:`sm`,variant:`outline`,children:`Ver todo`})})]}),(0,i.jsx)(u,{children:(0,i.jsx)(`p`,{className:`text-2xl font-bold text-red-400`,children:`$12,500,000`})}),(0,i.jsx)(d,{children:(0,i.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:`Actualizado hace 2 min`})})]})},h={render:()=>(0,i.jsx)(a,{children:(0,i.jsx)(u,{children:(0,i.jsx)(`p`,{className:`text-sm`,children:`Contenido simple sin encabezado.`})})})};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader>
        <CardTitle>Resumen del mes</CardTitle>
        <CardDescription>Abril 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">$4,800,000</p>
        <p className="text-sm text-muted-foreground">Ingresos totales</p>
      </CardContent>
    </Card>
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader>
        <CardTitle>Deuda activa</CardTitle>
        <CardDescription>2 créditos pendientes</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">Ver todo</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-red-400">$12,500,000</p>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Actualizado hace 2 min</p>
      </CardFooter>
    </Card>
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  render: () => <Card>
      <CardContent>
        <p className="text-sm">Contenido simple sin encabezado.</p>
      </CardContent>
    </Card>
}`,...h.parameters?.docs?.source}}};var g=[`Default`,`WithAction`,`Minimal`];export{p as Default,h as Minimal,m as WithAction,g as __namedExportsOrder,f as default};