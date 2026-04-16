"use client";

import React, { useEffect, useId, useMemo, useRef } from "react";
import { loadJSME } from "@/lib/jsme";

const JSMEEditor: React.FC<JSMEEditorProps> = ({
	initialSmiles = "",
	onSmilesChange,
	className = "",
}) => {
	const editorRef = useRef<JSMEInstance | null>(null);
	const rawId = useId();
	const containerId = useMemo(
		() => `jsme-container-${rawId.replace(/[:]/g, "-")}`,
		[rawId]
	);

	useEffect(() => {
		let cancelled = false;

		const mountEditor = async () => {
			await loadJSME();

			if (cancelled) return;

			const JSMEConstructor = window.JSApplet?.JSME;
			if (!JSMEConstructor) {
				throw new Error("JSME finished loading but JSApplet.JSME is unavailable.");
			}

			const params: Record<string, string> = {
				options: "oldlook,star",
			};

			if (initialSmiles.trim()) {
				params.smiles = initialSmiles.trim();
			}

			const applet = new JSMEConstructor(containerId, "100%", "100%", params);
			
			// TODO: hardcoded, change dynamically for different types of devices
			applet.setMolecularAreaScale?.(0.82);
			applet.setMenuScale?.(0.90);
			applet.repaint?.();
			editorRef.current = applet;

			const emitSmiles = (instance: JSMEInstance) => {
				const smiles = instance.smiles()?.trim() ?? "";
				onSmilesChange?.(smiles);
			};

			if (typeof applet.setCallBack === "function") {
				applet.setCallBack("AfterStructureModified", (event: JSMEEvent) => {
					emitSmiles(event.src);
				});
			}

			emitSmiles(applet);
		};

		void mountEditor();

		return () => {
			cancelled = true;
			editorRef.current = null;
		};
	}, [containerId, initialSmiles, onSmilesChange]);

	return (
		<div className={`jsme-shell ${className}`}>
			<div id={containerId} className="w-full h-full" />
		</div>
	);
};

export default JSMEEditor;