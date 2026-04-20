import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./button-CNP2-gLS.js";import{a as n,i as r,n as i,o as a,r as o,s,t as c}from"./dialog-DMSHB425.js";var l=e(),u={title:`UI/Dialog`,component:c,tags:[`autodocs`]},d={render:()=>(0,l.jsxs)(c,{children:[(0,l.jsx)(s,{asChild:!0,children:(0,l.jsx)(t,{variant:`outline`,children:`Abrir diálogo`})}),(0,l.jsxs)(i,{children:[(0,l.jsxs)(n,{children:[(0,l.jsx)(a,{children:`Confirmar eliminación`}),(0,l.jsx)(o,{children:`Esta acción no se puede deshacer. ¿Deseas continuar?`})]}),(0,l.jsxs)(r,{children:[(0,l.jsx)(t,{variant:`outline`,children:`Cancelar`}),(0,l.jsx)(t,{variant:`destructive`,children:`Eliminar`})]})]})]})},f={render:()=>(0,l.jsxs)(c,{children:[(0,l.jsx)(s,{asChild:!0,children:(0,l.jsx)(t,{children:`Ver términos`})}),(0,l.jsxs)(i,{children:[(0,l.jsx)(n,{children:(0,l.jsx)(a,{children:`Términos y condiciones`})}),(0,l.jsxs)(`div`,{className:`space-y-3 text-sm text-muted-foreground`,children:[(0,l.jsx)(`p`,{children:`Al usar esta aplicación, aceptas que tus datos financieros sean procesados de forma segura.`}),(0,l.jsx)(`p`,{children:`La información bancaria es encriptada y nunca se comparte con terceros.`}),(0,l.jsx)(`p`,{children:`Puedes eliminar tu cuenta y todos tus datos en cualquier momento desde Configuración.`})]}),(0,l.jsx)(r,{children:(0,l.jsx)(t,{children:`Aceptar`})})]})]})};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Abrir diálogo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. ¿Deseas continuar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancelar</Button>
          <Button variant="destructive">Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  render: () => <Dialog>
      <DialogTrigger asChild>
        <Button>Ver términos</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Términos y condiciones</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Al usar esta aplicación, aceptas que tus datos financieros sean procesados de forma segura.</p>
          <p>La información bancaria es encriptada y nunca se comparte con terceros.</p>
          <p>Puedes eliminar tu cuenta y todos tus datos en cualquier momento desde Configuración.</p>
        </div>
        <DialogFooter>
          <Button>Aceptar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,...f.parameters?.docs?.source}}};var p=[`Default`,`WithLongContent`];export{d as Default,f as WithLongContent,p as __namedExportsOrder,u as default};