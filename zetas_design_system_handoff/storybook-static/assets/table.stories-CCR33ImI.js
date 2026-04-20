import"./chunk-DseTPa7n.js";import{t as e}from"./react-CIi_Xeu6.js";import{t}from"./jsx-runtime-Ds4jeNO1.js";import{t as n}from"./utils-D4bLmd5U.js";import{t as r}from"./badge-CCZ7AQy1.js";e();var i=t();function a({className:e,...t}){return(0,i.jsx)(`div`,{"data-slot":`table-container`,className:`relative w-full overflow-x-auto`,children:(0,i.jsx)(`table`,{"data-slot":`table`,className:n(`w-full caption-bottom text-sm`,e),...t})})}function o({className:e,...t}){return(0,i.jsx)(`thead`,{"data-slot":`table-header`,className:n(`[&_tr]:border-b`,e),...t})}function s({className:e,...t}){return(0,i.jsx)(`tbody`,{"data-slot":`table-body`,className:n(`[&_tr:last-child]:border-0`,e),...t})}function c({className:e,...t}){return(0,i.jsx)(`tfoot`,{"data-slot":`table-footer`,className:n(`bg-muted/50 border-t font-medium [&>tr]:last:border-b-0`,e),...t})}function l({className:e,...t}){return(0,i.jsx)(`tr`,{"data-slot":`table-row`,className:n(`hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors`,e),...t})}function u({className:e,...t}){return(0,i.jsx)(`th`,{"data-slot":`table-head`,className:n(`text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`,e),...t})}function d({className:e,...t}){return(0,i.jsx)(`td`,{"data-slot":`table-cell`,className:n(`p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`,e),...t})}function f({className:e,...t}){return(0,i.jsx)(`caption`,{"data-slot":`table-caption`,className:n(`text-muted-foreground mt-4 text-sm`,e),...t})}a.__docgenInfo={description:``,methods:[],displayName:`Table`},o.__docgenInfo={description:``,methods:[],displayName:`TableHeader`},s.__docgenInfo={description:``,methods:[],displayName:`TableBody`},c.__docgenInfo={description:``,methods:[],displayName:`TableFooter`},u.__docgenInfo={description:``,methods:[],displayName:`TableHead`},l.__docgenInfo={description:``,methods:[],displayName:`TableRow`},d.__docgenInfo={description:``,methods:[],displayName:`TableCell`},f.__docgenInfo={description:``,methods:[],displayName:`TableCaption`};var p={title:`UI/Table`,component:a,tags:[`autodocs`]},m=[{id:1,desc:`Supermercado Éxito`,category:`Alimentación`,date:`01 abr`,amount:`-$124,500`},{id:2,desc:`Salario Empresa XYZ`,category:`Ingresos`,date:`01 abr`,amount:`+$4,800,000`},{id:3,desc:`Netflix`,category:`Entretenimiento`,date:`02 abr`,amount:`-$17,900`},{id:4,desc:`Gasolina`,category:`Transporte`,date:`03 abr`,amount:`-$85,000`}],h={render:()=>(0,i.jsxs)(a,{children:[(0,i.jsx)(f,{children:`Últimas transacciones de abril 2026`}),(0,i.jsx)(o,{children:(0,i.jsxs)(l,{children:[(0,i.jsx)(u,{children:`Descripción`}),(0,i.jsx)(u,{children:`Categoría`}),(0,i.jsx)(u,{children:`Fecha`}),(0,i.jsx)(u,{className:`text-right`,children:`Monto`})]})}),(0,i.jsx)(s,{children:m.map(e=>(0,i.jsxs)(l,{children:[(0,i.jsx)(d,{className:`font-medium`,children:e.desc}),(0,i.jsx)(d,{children:(0,i.jsx)(r,{variant:`outline`,children:e.category})}),(0,i.jsx)(d,{children:e.date}),(0,i.jsx)(d,{className:`text-right font-mono ${e.amount.startsWith(`+`)?`text-green-400`:``}`,children:e.amount})]},e.id))}),(0,i.jsx)(c,{children:(0,i.jsxs)(l,{children:[(0,i.jsx)(d,{colSpan:3,children:`Total neto`}),(0,i.jsx)(d,{className:`text-right font-mono`,children:`+$4,572,600`})]})})]})},g={render:()=>(0,i.jsxs)(a,{children:[(0,i.jsx)(o,{children:(0,i.jsxs)(l,{children:[(0,i.jsx)(u,{children:`Descripción`}),(0,i.jsx)(u,{children:`Monto`}),(0,i.jsx)(u,{children:`Fecha`})]})}),(0,i.jsx)(s,{children:(0,i.jsx)(l,{children:(0,i.jsx)(d,{colSpan:3,className:`text-center text-muted-foreground py-8`,children:`No hay transacciones en este período.`})})})]})};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  render: () => <Table>
      <TableCaption>Últimas transacciones de abril 2026</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Descripción</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Monto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(t => <TableRow key={t.id}>
            <TableCell className="font-medium">{t.desc}</TableCell>
            <TableCell>
              <Badge variant="outline">{t.category}</Badge>
            </TableCell>
            <TableCell>{t.date}</TableCell>
            <TableCell className={\`text-right font-mono \${t.amount.startsWith("+") ? "text-green-400" : ""}\`}>
              {t.amount}
            </TableCell>
          </TableRow>)}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total neto</TableCell>
          <TableCell className="text-right font-mono">+$4,572,600</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: () => <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descripción</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Fecha</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
            No hay transacciones en este período.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
}`,...g.parameters?.docs?.source}}};var _=[`Default`,`Empty`];export{h as Default,g as Empty,_ as __namedExportsOrder,p as default};