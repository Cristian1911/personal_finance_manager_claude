import"./chunk-DseTPa7n.js";import{t as e}from"./react-CIi_Xeu6.js";import{t}from"./jsx-runtime-Ds4jeNO1.js";import{t as n}from"./x-C6tvQuFe.js";import{t as r}from"./utils-D4bLmd5U.js";import{a as i,c as a,i as o,n as s,o as c,r as l,s as u,t as d}from"./dist-DK8dGIzf.js";import{t as f}from"./button-CNP2-gLS.js";e();var p=t();function m({...e}){return(0,p.jsx)(c,{"data-slot":`sheet`,...e})}function h({...e}){return(0,p.jsx)(a,{"data-slot":`sheet-trigger`,...e})}function g({...e}){return(0,p.jsx)(d,{"data-slot":`sheet-close`,...e})}function _({...e}){return(0,p.jsx)(i,{"data-slot":`sheet-portal`,...e})}function v({className:e,...t}){return(0,p.jsx)(o,{"data-slot":`sheet-overlay`,className:r(`data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[10000] bg-black/50`,e),...t})}function y({className:e,children:t,side:i=`right`,showCloseButton:a=!0,...o}){return(0,p.jsxs)(_,{children:[(0,p.jsx)(v,{}),(0,p.jsxs)(s,{"data-slot":`sheet-content`,className:r(`bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-[10000] flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500`,i===`right`&&`data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm`,i===`left`&&`data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm`,i===`top`&&`data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b`,i===`bottom`&&`data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t`,e),...o,children:[t,a&&(0,p.jsxs)(d,{className:`ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none`,children:[(0,p.jsx)(n,{className:`size-4`}),(0,p.jsx)(`span`,{className:`sr-only`,children:`Close`})]})]})]})}function b({className:e,...t}){return(0,p.jsx)(`div`,{"data-slot":`sheet-header`,className:r(`flex flex-col gap-1.5 p-4`,e),...t})}function x({className:e,...t}){return(0,p.jsx)(`div`,{"data-slot":`sheet-footer`,className:r(`mt-auto flex flex-col gap-2 p-4`,e),...t})}function S({className:e,...t}){return(0,p.jsx)(u,{"data-slot":`sheet-title`,className:r(`text-foreground font-semibold`,e),...t})}function C({className:e,...t}){return(0,p.jsx)(l,{"data-slot":`sheet-description`,className:r(`text-muted-foreground text-sm`,e),...t})}m.__docgenInfo={description:``,methods:[],displayName:`Sheet`},h.__docgenInfo={description:``,methods:[],displayName:`SheetTrigger`},g.__docgenInfo={description:``,methods:[],displayName:`SheetClose`},y.__docgenInfo={description:``,methods:[],displayName:`SheetContent`,props:{side:{required:!1,tsType:{name:`union`,raw:`"top" | "right" | "bottom" | "left"`,elements:[{name:`literal`,value:`"top"`},{name:`literal`,value:`"right"`},{name:`literal`,value:`"bottom"`},{name:`literal`,value:`"left"`}]},description:``,defaultValue:{value:`"right"`,computed:!1}},showCloseButton:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`true`,computed:!1}}}},b.__docgenInfo={description:``,methods:[],displayName:`SheetHeader`},x.__docgenInfo={description:``,methods:[],displayName:`SheetFooter`},S.__docgenInfo={description:``,methods:[],displayName:`SheetTitle`},C.__docgenInfo={description:``,methods:[],displayName:`SheetDescription`};var w={title:`UI/Sheet`,component:m,tags:[`autodocs`],argTypes:{}},T={render:()=>(0,p.jsxs)(m,{children:[(0,p.jsx)(h,{asChild:!0,children:(0,p.jsx)(f,{variant:`outline`,children:`Abrir panel derecho`})}),(0,p.jsxs)(y,{children:[(0,p.jsxs)(b,{children:[(0,p.jsx)(S,{children:`Filtrar transacciones`}),(0,p.jsx)(C,{children:`Ajusta los filtros para encontrar lo que buscas.`})]}),(0,p.jsx)(`div`,{className:`px-4 py-2 text-sm text-muted-foreground`,children:`Opciones de filtro aquí...`}),(0,p.jsxs)(x,{children:[(0,p.jsx)(g,{asChild:!0,children:(0,p.jsx)(f,{variant:`outline`,children:`Cancelar`})}),(0,p.jsx)(f,{children:`Aplicar`})]})]})]})},E={render:()=>(0,p.jsxs)(m,{children:[(0,p.jsx)(h,{asChild:!0,children:(0,p.jsx)(f,{variant:`outline`,children:`Menú`})}),(0,p.jsxs)(y,{side:`left`,children:[(0,p.jsx)(b,{children:(0,p.jsx)(S,{children:`Navegación`})}),(0,p.jsxs)(`nav`,{className:`px-4 space-y-2 text-sm`,children:[(0,p.jsx)(`p`,{className:`py-2 font-medium`,children:`Dashboard`}),(0,p.jsx)(`p`,{className:`py-2`,children:`Transacciones`}),(0,p.jsx)(`p`,{className:`py-2`,children:`Presupuesto`}),(0,p.jsx)(`p`,{className:`py-2`,children:`Cuentas`})]})]})]})},D={render:()=>(0,p.jsxs)(m,{children:[(0,p.jsx)(h,{asChild:!0,children:(0,p.jsx)(f,{variant:`outline`,children:`Panel inferior`})}),(0,p.jsxs)(y,{side:`bottom`,children:[(0,p.jsx)(b,{children:(0,p.jsx)(S,{children:`Acciones rápidas`})}),(0,p.jsxs)(`div`,{className:`px-4 py-2 grid grid-cols-3 gap-2`,children:[(0,p.jsx)(f,{variant:`outline`,size:`sm`,children:`Nuevo gasto`}),(0,p.jsx)(f,{variant:`outline`,size:`sm`,children:`Importar`}),(0,p.jsx)(f,{variant:`outline`,size:`sm`,children:`Ver reporte`})]})]})]})};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  render: () => <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Abrir panel derecho</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtrar transacciones</SheetTitle>
          <SheetDescription>
            Ajusta los filtros para encontrar lo que buscas.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 py-2 text-sm text-muted-foreground">
          Opciones de filtro aquí...
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancelar</Button>
          </SheetClose>
          <Button>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  render: () => <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Menú</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navegación</SheetTitle>
        </SheetHeader>
        <nav className="px-4 space-y-2 text-sm">
          <p className="py-2 font-medium">Dashboard</p>
          <p className="py-2">Transacciones</p>
          <p className="py-2">Presupuesto</p>
          <p className="py-2">Cuentas</p>
        </nav>
      </SheetContent>
    </Sheet>
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  render: () => <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Panel inferior</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Acciones rápidas</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-2 grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm">Nuevo gasto</Button>
          <Button variant="outline" size="sm">Importar</Button>
          <Button variant="outline" size="sm">Ver reporte</Button>
        </div>
      </SheetContent>
    </Sheet>
}`,...D.parameters?.docs?.source}}};var O=[`Right`,`Left`,`Bottom`];export{D as Bottom,E as Left,T as Right,O as __namedExportsOrder,w as default};