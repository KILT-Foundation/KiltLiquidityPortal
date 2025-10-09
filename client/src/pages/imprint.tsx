import React from "react";
import backgroundVideo from "@assets/Untitled design (22)_1752822331413.mp4";

export default function ImprintPage() {
	return (
		<div className="min-h-screen text-white overflow-x-hidden relative">
			<video
				autoPlay
				muted
				loop
				playsInline
				preload="auto"
				className="fixed top-0 left-0 w-full h-full object-cover"
				style={{ zIndex: 1 }}
			>
				<source src={backgroundVideo} type="video/mp4" />
			</video>
			<div className="absolute inset-0 bg-black/30" style={{ zIndex: 2 }}></div>

			<div className="relative" style={{ zIndex: 10 }}>
				<div className="max-w-7xl mx-auto px-4 pt-12 pb-28">
					<h1 className="leading-none mb-10 font-extrabold text-white text-[12vw] sm:text-6xl lg:text-7xl tracking-tight">
						Imprint
					</h1>

					<div className="space-y-8 text-white/90 text-lg sm:text-xl">
						<h2 className="text-2xl sm:text-3xl font-semibold">KILT Foundation</h2>

						<section>
							<h3 className="text-xl font-semibold mb-2">Address</h3>
							<p>
								Genesis Building, 5th Floor, Genesis Close,<br />
								PO Box 446, Cayman Islands, KY1-1106
							</p>
						</section>

						<section>
							<h3 className="text-xl font-semibold mb-2">Certificate</h3>
							<p>Certificate No. 418097</p>
						</section>

						<section>
							<h3 className="text-xl font-semibold mb-2">Directors</h3>
							<p>Rishant Kumar, Svetoslav Boyadzhiev</p>
						</section>

						<section>
							<h3 className="text-xl font-semibold mb-2">Contact</h3>
							<p>
								<a href="mailto:hello@kilt.io" className="underline">hello@kilt.io</a>
							</p>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
