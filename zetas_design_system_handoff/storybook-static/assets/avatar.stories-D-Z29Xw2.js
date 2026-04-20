import{i as e}from"./chunk-DseTPa7n.js";import{t}from"./react-CIi_Xeu6.js";import{t as n}from"./jsx-runtime-Ds4jeNO1.js";import{t as r}from"./utils-D4bLmd5U.js";import{t as i}from"./dist-DFU7f1XP.js";import{n as a}from"./dist-DYfflQJa.js";import{t as o}from"./dist-pqhuu1j4.js";import{t as s}from"./dist-Bvym8xJ9.js";import{t as c}from"./shim-BVpObM63.js";var l=c();function u(){return(0,l.useSyncExternalStore)(d,()=>!0,()=>!1)}function d(){return()=>{}}var f=e(t(),1),p=n(),m=`Avatar`,[h,g]=a(m),[_,v]=h(m),y=f.forwardRef((e,t)=>{let{__scopeAvatar:n,...r}=e,[a,o]=f.useState(`idle`);return(0,p.jsx)(_,{scope:n,imageLoadingStatus:a,onImageLoadingStatusChange:o,children:(0,p.jsx)(i.span,{...r,ref:t})})});y.displayName=m;var b=`AvatarImage`,x=f.forwardRef((e,t)=>{let{__scopeAvatar:n,src:r,onLoadingStatusChange:a=()=>{},...c}=e,l=v(b,n),u=T(r,c),d=s(e=>{a(e),l.onImageLoadingStatusChange(e)});return o(()=>{u!==`idle`&&d(u)},[u,d]),u===`loaded`?(0,p.jsx)(i.img,{...c,ref:t,src:r}):null});x.displayName=b;var S=`AvatarFallback`,C=f.forwardRef((e,t)=>{let{__scopeAvatar:n,delayMs:r,...a}=e,o=v(S,n),[s,c]=f.useState(r===void 0);return f.useEffect(()=>{if(r!==void 0){let e=window.setTimeout(()=>c(!0),r);return()=>window.clearTimeout(e)}},[r]),s&&o.imageLoadingStatus!==`loaded`?(0,p.jsx)(i.span,{...a,ref:t}):null});C.displayName=S;function w(e,t){return e?t?(e.src!==t&&(e.src=t),e.complete&&e.naturalWidth>0?`loaded`:`loading`):`error`:`idle`}function T(e,{referrerPolicy:t,crossOrigin:n}){let r=u(),i=f.useRef(null),a=r?(i.current||=new window.Image,i.current):null,[s,c]=f.useState(()=>w(a,e));return o(()=>{c(w(a,e))},[a,e]),o(()=>{let e=e=>()=>{c(e)};if(!a)return;let r=e(`loaded`),i=e(`error`);return a.addEventListener(`load`,r),a.addEventListener(`error`,i),t&&(a.referrerPolicy=t),typeof n==`string`&&(a.crossOrigin=n),()=>{a.removeEventListener(`load`,r),a.removeEventListener(`error`,i)}},[a,n,t]),s}var E=y,D=x,O=C;function k({className:e,size:t=`default`,...n}){return(0,p.jsx)(E,{"data-slot":`avatar`,"data-size":t,className:r(`group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6`,e),...n})}function A({className:e,...t}){return(0,p.jsx)(D,{"data-slot":`avatar-image`,className:r(`aspect-square size-full`,e),...t})}function j({className:e,...t}){return(0,p.jsx)(O,{"data-slot":`avatar-fallback`,className:r(`bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs`,e),...t})}function M({className:e,...t}){return(0,p.jsx)(`span`,{"data-slot":`avatar-badge`,className:r(`bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 select-none`,`group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden`,`group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2`,`group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2`,e),...t})}function N({className:e,...t}){return(0,p.jsx)(`div`,{"data-slot":`avatar-group`,className:r(`*:data-[slot=avatar]:ring-background group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2`,e),...t})}function P({className:e,...t}){return(0,p.jsx)(`div`,{"data-slot":`avatar-group-count`,className:r(`bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm ring-2 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3`,e),...t})}k.__docgenInfo={description:``,methods:[],displayName:`Avatar`,props:{size:{required:!1,tsType:{name:`union`,raw:`"default" | "sm" | "lg"`,elements:[{name:`literal`,value:`"default"`},{name:`literal`,value:`"sm"`},{name:`literal`,value:`"lg"`}]},description:``,defaultValue:{value:`"default"`,computed:!1}}}},A.__docgenInfo={description:``,methods:[],displayName:`AvatarImage`},j.__docgenInfo={description:``,methods:[],displayName:`AvatarFallback`},M.__docgenInfo={description:``,methods:[],displayName:`AvatarBadge`},N.__docgenInfo={description:``,methods:[],displayName:`AvatarGroup`},P.__docgenInfo={description:``,methods:[],displayName:`AvatarGroupCount`};var F={title:`UI/Avatar`,component:k,tags:[`autodocs`],argTypes:{size:{control:`select`,options:[`sm`,`default`,`lg`]}}},I={render:e=>(0,p.jsxs)(k,{...e,children:[(0,p.jsx)(A,{src:`https://github.com/shadcn.png`,alt:`Usuario`}),(0,p.jsx)(j,{children:`CG`})]}),args:{size:`default`}},L={render:e=>(0,p.jsx)(k,{...e,children:(0,p.jsx)(j,{children:`CG`})}),args:{size:`default`}},R={render:e=>(0,p.jsx)(k,{...e,children:(0,p.jsx)(j,{children:`AB`})}),args:{size:`lg`}},z={render:e=>(0,p.jsx)(k,{...e,children:(0,p.jsx)(j,{children:`XY`})}),args:{size:`sm`}},B={render:e=>(0,p.jsxs)(k,{...e,children:[(0,p.jsx)(j,{children:`CG`}),(0,p.jsx)(M,{})]}),args:{size:`default`}},V={render:()=>(0,p.jsxs)(N,{children:[(0,p.jsx)(k,{children:(0,p.jsx)(j,{children:`CG`})}),(0,p.jsx)(k,{children:(0,p.jsx)(j,{children:`AB`})}),(0,p.jsx)(k,{children:(0,p.jsx)(j,{children:`XY`})}),(0,p.jsx)(P,{children:`+3`})]})};I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  render: args => <Avatar {...args}>
      <AvatarImage src="https://github.com/shadcn.png" alt="Usuario" />
      <AvatarFallback>CG</AvatarFallback>
    </Avatar>,
  args: {
    size: "default"
  }
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  render: args => <Avatar {...args}>
      <AvatarFallback>CG</AvatarFallback>
    </Avatar>,
  args: {
    size: "default"
  }
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  render: args => <Avatar {...args}>
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>,
  args: {
    size: "lg"
  }
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  render: args => <Avatar {...args}>
      <AvatarFallback>XY</AvatarFallback>
    </Avatar>,
  args: {
    size: "sm"
  }
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  render: args => <Avatar {...args}>
      <AvatarFallback>CG</AvatarFallback>
      <AvatarBadge />
    </Avatar>,
  args: {
    size: "default"
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  render: () => <AvatarGroup>
      <Avatar>
        <AvatarFallback>CG</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>XY</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
}`,...V.parameters?.docs?.source}}};var H=[`Default`,`Fallback`,`Large`,`Small`,`WithBadge`,`Group`];export{I as Default,L as Fallback,V as Group,R as Large,z as Small,B as WithBadge,H as __namedExportsOrder,F as default};