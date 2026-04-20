import{t as e}from"./jsx-runtime-Ds4jeNO1.js";import{t}from"./utils-D4bLmd5U.js";var n=e();function r({className:e,...r}){return(0,n.jsx)(`div`,{"data-slot":`skeleton`,className:t(`bg-accent animate-pulse rounded-md`,e),...r})}r.__docgenInfo={description:``,methods:[],displayName:`Skeleton`};var i={title:`UI/Skeleton`,component:r,tags:[`autodocs`]},a={render:()=>(0,n.jsx)(r,{className:`h-4 w-48`})},o={render:()=>(0,n.jsxs)(`div`,{className:`w-80 rounded-xl border p-6 space-y-4`,children:[(0,n.jsxs)(`div`,{className:`space-y-2`,children:[(0,n.jsx)(r,{className:`h-4 w-32`}),(0,n.jsx)(r,{className:`h-3 w-24`})]}),(0,n.jsx)(r,{className:`h-8 w-48`}),(0,n.jsxs)(`div`,{className:`space-y-2`,children:[(0,n.jsx)(r,{className:`h-3 w-full`}),(0,n.jsx)(r,{className:`h-3 w-4/5`})]})]})},s={render:()=>(0,n.jsx)(`div`,{className:`space-y-2 w-full max-w-sm`,children:[1,2,3].map(e=>(0,n.jsxs)(`div`,{className:`flex items-center justify-between gap-3 py-2`,children:[(0,n.jsx)(r,{className:`size-8 rounded-full`}),(0,n.jsxs)(`div`,{className:`flex-1 space-y-1`,children:[(0,n.jsx)(r,{className:`h-3 w-32`}),(0,n.jsx)(r,{className:`h-2 w-20`})]}),(0,n.jsx)(r,{className:`h-4 w-20`})]},e))})},c={render:()=>(0,n.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,n.jsx)(r,{className:`size-10 rounded-full`}),(0,n.jsxs)(`div`,{className:`space-y-1`,children:[(0,n.jsx)(r,{className:`h-4 w-24`}),(0,n.jsx)(r,{className:`h-3 w-16`})]})]})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Skeleton className="h-4 w-48" />
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-80 rounded-xl border p-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <div className="space-y-2 w-full max-w-sm">
      {[1, 2, 3].map(i => <div key={i} className="flex items-center justify-between gap-3 py-2">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-20" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>)}
    </div>
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
}`,...c.parameters?.docs?.source}}};var l=[`Default`,`CardSkeleton`,`TransactionRow`,`AvatarSkeleton`];export{c as AvatarSkeleton,o as CardSkeleton,a as Default,s as TransactionRow,l as __namedExportsOrder,i as default};