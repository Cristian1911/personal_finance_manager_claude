"use client";

import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import type { CategoryWithChildren, Category, Budget } from "@/types/domain";
import { Lock, GripVertical, Check } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    DropAnimation,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateCategoryOrder } from "@/actions/categories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BudgetFormDialog } from "@/components/categories/budget-form-dialog";

interface SortableCategoryItemProps {
    id: string;
    category: Category;
    budget?: Budget;
}

function SortableCategoryItem({ id, category, budget }: SortableCategoryItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, data: { category } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-3 px-4 py-2.5 bg-background border-b last:border-0",
                isDragging && "opacity-50 relative z-10 shadow-sm"
            )}
        >
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab hover:bg-muted p-1 rounded-md text-muted-foreground mr-1 h-7 w-7 flex items-center justify-center shrink-0 touch-none focus:outline-none"
            >
                <GripVertical className="h-4 w-4" />
            </button>

            <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: category.color || "rgba(0,0,0,0.2)" }}
            />

            <span className="text-sm flex-1 font-medium">
                {category.name_es || category.name}
            </span>

            {/* Budget Indicator/Editor */}
            <div className="mr-6">
                <BudgetFormDialog
                    categoryId={category.id}
                    categoryName={category.name_es || category.name}
                    budgetId={budget?.id}
                    currentAmount={budget?.amount || 0}
                />
            </div>

            <div className="flex items-center gap-2">
                {category.is_essential && (
                    <Badge variant="outline" className="text-xs">
                        Esencial
                    </Badge>
                )}
                {category.is_system && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                )}
            </div>
        </div>
    );
}

interface SortableGroupProps {
    id: string;
    group: Category;
    items: Category[];
    budgets?: Budget[];
}

function SortableGroup({ id, group, items, budgets }: SortableGroupProps) {
    return (
        <div className="mb-6 rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b">
                <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.color || "rgba(0,0,0,0.2)" }}
                />
                <span className="text-sm font-semibold flex-1">
                    {group.name_es || group.name}
                </span>
                <Badge variant="secondary" className="text-xs opacity-70">
                    {items.length}
                </Badge>
                {group.is_system && <Lock className="h-3 w-3 text-muted-foreground" />}
            </div>

            <SortableContext id={id} items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col min-h-[40px] bg-background">
                    {items.map((item) => (
                        <SortableCategoryItem
                            key={item.id}
                            id={item.id}
                            category={item}
                            budget={budgets?.find(b => b.category_id === item.id)}
                        />
                    ))}
                    {items.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4 italic">
                            Sin elementos (arrastra aquí)
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

export function SortableCategoryList({
    initialCategories,
    budgets,
}: {
    initialCategories: CategoryWithChildren[];
    budgets?: Budget[];
}) {
    const [groups, setGroups] = useState<Category[]>([]);
    const [items, setItems] = useState<Record<string, Category[]>>({});
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const g: Category[] = [];
        const grpItems: Record<string, Category[]> = {};

        initialCategories.forEach((cat) => {
            g.push({ ...cat, children: undefined } as Category);
            grpItems[cat.id] = [...cat.children].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        });

        setGroups(g);
        setItems(grpItems);
    }, [initialCategories]);

    const findContainer = (id: string) => {
        if (id in items) return id;
        return Object.keys(items).find((key) =>
            items[key].some((item) => item.id === id)
        );
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const activeContainer = findContainer(active.id as string);
        if (!activeContainer) return;
        setActiveId(active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);

        if (!activeContainer || !overContainer) return;

        if (activeContainer !== overContainer) {
            setItems((prev) => {
                const activeItems = prev[activeContainer];
                const overItems = prev[overContainer];
                const activeIndex = activeItems.findIndex((i) => i.id === active.id);
                const overIndex = overItems.findIndex((i) => i.id === overId);

                let newIndex;
                if (overId in prev) {
                    newIndex = overItems.length + 1;
                } else {
                    const isBelowOverItem =
                        over &&
                        active.rect.current.translated &&
                        active.rect.current.translated.top > over.rect.top + over.rect.height;
                    const modifier = isBelowOverItem ? 1 : 0;
                    newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
                }

                const activeCat = activeItems[activeIndex];

                return {
                    ...prev,
                    [activeContainer]: activeItems.filter((i) => i.id !== active.id),
                    [overContainer]: [
                        ...overItems.slice(0, newIndex),
                        { ...activeCat, parent_id: overContainer },
                        ...overItems.slice(newIndex, overItems.length),
                    ],
                };
            });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over.id as string);

        if (!activeContainer || !overContainer) return;

        if (activeContainer === overContainer) {
            const idxActive = items[activeContainer].findIndex((i) => i.id === active.id);
            const idxOver = items[overContainer].findIndex((i) => i.id === over.id);

            if (idxActive !== idxOver) {
                setItems((prev) => ({
                    ...prev,
                    [activeContainer]: arrayMove(prev[activeContainer], idxActive, idxOver),
                }));
            }
        }
    };

    const saveOrder = async () => {
        setIsSaving(true);
        try {
            const payload: { id: string; display_order: number; parent_id: string | null }[] = [];

            groups.forEach((group) => {
                const groupItems = items[group.id] || [];
                groupItems.forEach((item, index) => {
                    // Increment display_order internally starting from 10 or similar? 
                    // 1, 2, 3 is fine for local scoping
                    payload.push({
                        id: item.id,
                        display_order: (index + 1) * 10, // Gives gap space
                        parent_id: group.id,
                    });
                });
            });

            const res = await updateCategoryOrder(payload);
            if (res.success) {
                toast.success("Orden actualizado correctamente", {
                    icon: <Check className="h-4 w-4 text-green-500" />
                });
            } else {
                toast.error(res.error || "No se pudo guardar el orden");
            }
        } catch (e) {
            toast.error("Error inesperado guardando el orden");
        } finally {
            setIsSaving(false);
        }
    };

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: "0.4" } },
        }),
    };

    const getActiveItem = () => {
        if (!activeId) return null;
        for (const group of Object.values(items)) {
            const f = group.find((i) => i.id === activeId);
            if (f) return f;
        }
        return null;
    };

    const activeItem = getActiveItem();

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-dashed">
                <p className="text-sm text-muted-foreground">
                    Arrastra las categorías para ordenarlas o cambiarlas de grupo.
                </p>
                <Button onClick={saveOrder} disabled={isSaving} size="sm">
                    {isSaving ? "Guardando..." : "Guardar orden"}
                </Button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="grid gap-2">
                    {groups.map((group) => (
                        <SortableGroup
                            key={group.id}
                            id={group.id}
                            group={group}
                            items={items[group.id] || []}
                            budgets={budgets}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeItem ? (
                        <div className="bg-background border rounded-lg shadow-xl ring-1 ring-ring/10">
                            <div className="flex items-center gap-3 px-4 py-3">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <div
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: activeItem.color || "rgba(0,0,0,0.2)" }}
                                />
                                <span className="text-sm font-medium">{activeItem.name_es || activeItem.name}</span>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
