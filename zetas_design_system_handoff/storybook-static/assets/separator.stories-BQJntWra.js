import{i as e}from"./chunk-DseTPa7n.js";import{t}from"./react-CIi_Xeu6.js";import{t as n}from"./jsx-runtime-Ds4jeNO1.js";import{t as r}from"./utils-D4bLmd5U.js";import{t as i}from"./dist-DFU7f1XP.js";var a=e(t(),1),o=n(),s=`Separator`,c=`horizontal`,l=[`horizontal`,`vertical`],u=a.forwardRef((e,t)=>{let{decorative:n,orientation:r=c,...a}=e,s=d(r)?r:c,l=n?{role:`none`}:{"aria-orientation":s===`vertical`?s:void 0,role:`separator`};return(0,o.jsx)(i.div,{"data-orientation":s,...l,...a,ref:t})});u.displayName=s;function d(e){return l.includes(e)}var f=u;function p({className:e,orientation:t=`horizontal`,decorative:n=!0,...i}){return(0,o.jsx)(f,{"data-slot":`separator`,decorative:n,orientation:t,className:r(`bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px`,e),...i})}p.__docgenInfo={description:``,methods:[],displayName:`Separator`,props:{orientation:{defaultValue:{value:`"horizontal"`,computed:!1},required:!1},decorative:{defaultValue:{value:`true`,computed:!1},required:!1}}};var m={title:`UI/Separator`,component:p,tags:[`autodocs`],argTypes:{orientation:{control:`select`,options:[`horizontal`,`vertical`]}}},h={render:()=>(0,o.jsxs)(`div`,{className:`w-64 p-4 space-y-4`,children:[(0,o.jsx)(`p`,{className:`text-sm`,children:`Ingresos: $4,800,000`}),(0,o.jsx)(p,{}),(0,o.jsx)(`p`,{className:`text-sm`,children:`Gastos: $2,340,000`})]})},g={render:()=>(0,o.jsxs)(`div`,{className:`flex h-12 items-center gap-4 p-4`,children:[(0,o.jsx)(`span`,{className:`text-sm`,children:`Gastos`}),(0,o.jsx)(p,{orientation:`vertical`}),(0,o.jsx)(`span`,{className:`text-sm`,children:`Ingresos`}),(0,o.jsx)(p,{orientation:`vertical`}),(0,o.jsx)(`span`,{className:`text-sm`,children:`Ahorros`})]})};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-64 p-4 space-y-4">
      <p className="text-sm">Ingresos: $4,800,000</p>
      <Separator />
      <p className="text-sm">Gastos: $2,340,000</p>
    </div>
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex h-12 items-center gap-4 p-4">
      <span className="text-sm">Gastos</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Ingresos</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Ahorros</span>
    </div>
}`,...g.parameters?.docs?.source}}};var _=[`Horizontal`,`Vertical`];export{h as Horizontal,g as Vertical,_ as __namedExportsOrder,m as default};