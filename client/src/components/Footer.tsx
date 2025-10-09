import React from "react";
import { Link } from "wouter";

const items = [
	{ label: "Home", internal: true, href: "/" },
	{ label: "Imprint", internal: true, href: "/imprint" },
	{ label: "Privacy Policy", internal: true, href: "/privacy" },
	{ label: "Terms & Conditions", internal: true, href: "/terms" },
	{ label: "Disclaimer", internal: true, href: "/disclaimer" },
];

export default function Footer() {
	return (
		<footer className="relative z-50 w-full border-t border-white/10 bg-black/40 backdrop-blur-xl text-primary shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
			{/* subtle top fade to blend with background */}
			<div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
			<div className="relative z-10 max-w-6xl mx-auto px-4 py-4">
				<nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
					{items.map((item, idx) => (
						<React.Fragment key={item.label}>
							<Link href={item.href}>
								<a className="hover:underline text-white/90 hover:text-white transition-colors">{item.label}</a>
							</Link>
							{idx < items.length - 1 && <span className="text-white/50">|</span>}
						</React.Fragment>
					))}
				</nav>
			</div>
		</footer>
	);
}