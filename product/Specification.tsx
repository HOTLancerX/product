'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

interface SpecificationField {
    title: string;
    description: string;
}

interface SpecificationBox {
    title: string;
    fields: SpecificationField[];
}

interface SpecificationProps {
    title?: string;
    specifications: SpecificationBox[];
    style?: number;
}

// Filter helpers
function filterFields(fields: SpecificationField[]) {
    return fields.filter(f => f.description && f.description.trim() !== '');
}

function filterBoxes(boxes: SpecificationBox[]) {
    return boxes
        .map(box => ({ ...box, fields: filterFields(box.fields) }))
        .filter(box => box.fields.length > 0);
}

export default function Specification({ specifications, title, style = 1 }: SpecificationProps) {
    const [activeTab, setActiveTab] = useState(0);

    if (!specifications || specifications.length === 0) return null;

    const visibleSpecs = filterBoxes(specifications);
    if (visibleSpecs.length === 0) return null;

    // Style 1: Accordion
    if (style === 1) {
        return (
            <div className="mt-8">
                {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
                <div className="space-y-4">
                    {visibleSpecs.map((box, i) => (
                        <AccordionBox key={i} box={box} defaultOpen={i === 0} />
                    ))}
                </div>
            </div>
        );
    }

    // Style 2: Tabs
    if (style === 2) {
        const safeTab = activeTab >= visibleSpecs.length ? 0 : activeTab;
        return (
            <div className="mt-8">
                {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
                <div className="border rounded-lg overflow-hidden">
                    <div className="flex border-b bg-gray-50 overflow-x-auto">
                        {visibleSpecs.map((box, i) => (
                            <button
                                key={i}
                                onClick={() => setActiveTab(i)}
                                className={`px-6 py-3 font-medium whitespace-nowrap transition-colors ${safeTab === i
                                    ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {box.title}
                            </button>
                        ))}
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            {visibleSpecs[safeTab].fields.map((field, i) => (
                                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 border-b last:border-b-0">
                                    <div className="font-semibold text-gray-700">{field.title}</div>
                                    <div className="md:col-span-2 text-gray-600">{field.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Style 3: Grid Cards
    if (style === 3) {
        return (
            <div className="mt-8">
                {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {visibleSpecs.map((box, i) => (
                        <div key={i} className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-xl font-semibold mb-4 text-blue-600 flex items-center gap-2">
                                <Icon icon="mdi:folder-open" width="24" height="24" />
                                {box.title}
                            </h3>
                            <div className="space-y-3">
                                {box.fields.map((field, j) => (
                                    <div key={j} className="pb-3 border-b last:border-b-0">
                                        <div className="text-sm font-medium text-gray-700 mb-1">{field.title}</div>
                                        <div className="text-sm text-gray-600">{field.description}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Style 4: Table
    if (style === 4) {
        return (
            <div className="mt-8">
                {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
                <div className="space-y-6">
                    {visibleSpecs.map((box, i) => (
                        <div key={i} className="border rounded-lg overflow-hidden">
                            <div className="bg-blue-600 text-white px-6 py-3">
                                <h3 className="text-lg font-semibold">{box.title}</h3>
                            </div>
                            <table className="w-full">
                                <tbody>
                                    {box.fields.map((field, j) => (
                                        <tr key={j} className={j % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="px-6 py-3 font-medium text-gray-700 w-1/3">{field.title}</td>
                                            <td className="px-6 py-3 text-gray-600">{field.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Style 5: Compact List
    if (style === 5) {
        return (
            <div className="mt-8">
                {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
                <div className="border rounded-lg p-6 bg-gray-50">
                    {visibleSpecs.map((box, i) => (
                        <div key={i} className={i > 0 ? 'mt-6 pt-6 border-t' : ''}>
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">{box.title}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                                {box.fields.map((field, j) => (
                                    <div key={j} className="flex items-start gap-3">
                                        <Icon icon="mdi:check-circle" width="20" height="20" className="text-green-600 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="font-medium text-gray-700">{field.title}:</span>
                                            <span className="ml-2 text-gray-600">{field.description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    // Style 6: Compact List with toggle
    if (style === 6) {
        return <Style6 visibleSpecs={visibleSpecs} />;
    }

    // Default: Style 1
    return (
        <div>
            <h2 className="text-xl md:text-2xl font-bold mb-3">Specifications</h2>
            <div className="space-y-4">
                {visibleSpecs.map((box, i) => (
                    <AccordionBox key={i} box={box} defaultOpen={i === 0} />
                ))}
            </div>
        </div>
    );
}

function Style6({ visibleSpecs }: { visibleSpecs: SpecificationBox[] }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="py-16 bg-black text-white">
            <h2 className="text-2xl md:text-5xl font-bold mb-6 text-center">
                Now, here's the <span className='text-[#00c4c1]'>technical bit...</span>
            </h2>

            {/* Specs body — hidden by default */}
            <div
                className={`container block space-y-10 overflow-hidden transition-all duration-500 ${expanded ? 'max-h-[9999px] opacity-100 mb-8' : 'max-h-0 opacity-0'
                    }`}
            >
                {visibleSpecs.map((box, i) => (
                    <div key={i}>
                        <h3 className="text-2xl md:text-3xl font-bold mb-4">{box.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4">
                            {box.fields.map((field, j) => (
                                <div key={j} className="flex flex-col items-start">
                                    <strong className="font-medium text-xl text-gray-300">{field.title}</strong>
                                    <span className="font-normal">{field.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Toggle button */}
            <div className="flex justify-center">
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="inline-flex items-center gap-2 px-8 py-3 border border-white/40 rounded-full text-sm font-semibold tracking-wide hover:bg-white hover:text-black transition-colors duration-200"
                >
                    {expanded ? (
                        <>
                            Hide Specs
                            <Icon icon="mdi:chevron-up" width="18" height="18" />
                        </>
                    ) : (
                        <>
                            Full Specs
                            <Icon icon="mdi:chevron-down" width="18" height="18" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function AccordionBox({ box, defaultOpen = false }: { box: SpecificationBox; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                <h3 className="text-lg font-semibold text-gray-800">{box.title}</h3>
                <Icon icon={isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} width="24" height="24" className="text-gray-600" />
            </button>
            {isOpen && (
                <div className="bg-white">
                    {box.fields.map((field, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-3 border-b last:border-b-0 p-3">
                            <div className="font-semibold text-gray-700">{field.title}</div>
                            <div className="md:col-span-2 text-gray-600">{field.description}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
