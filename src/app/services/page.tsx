import Link from "next/link";

export default function ServicesPage() {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="min-h-screen w-full bg-white text-black font-mono pt-24 pb-12 px-4 md:px-8 flex flex-col items-center selection:bg-black selection:text-white">
      {/* Receipt Container */}
      <div className="w-full max-w-md bg-white border-2 border-dashed border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
        
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-6">
          <h1 className="text-3xl font-bold uppercase tracking-widest mb-2 font-mono">ZIPLINE MEDIA</h1>
          <p className="text-xs uppercase tracking-wider">New York City, NY</p>
          <p className="text-xs uppercase tracking-wider">EST. 2024</p>
          
          <div className="flex justify-between mt-6 text-xs uppercase border-t border-black pt-2">
            <span>Date: {date}</span>
            <span>Time: {time}</span>
          </div>
          <div className="flex justify-between text-xs uppercase">
             <span>Order #: 0001</span>
             <span>Customer: YOU</span>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-4 mb-8 text-sm uppercase">
          <div className="grid grid-cols-[1fr_auto] gap-4 font-bold border-b border-black pb-2">
            <span>Description</span>
            <span>Price</span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <span className="font-bold">01. PRODUCTION</span>
              <p className="text-xs text-gray-600 mt-1 pl-4 opacity-80">- 4K Cinema Cameras</p>
              <p className="text-xs text-gray-600 pl-4 opacity-80">- Professional Lighting</p>
              <p className="text-xs text-gray-600 pl-4 opacity-80">- Audio Engineering</p>
            </div>
            <span className="font-bold">$$$</span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <span className="font-bold">02. POST-PRODUCTION</span>
              <p className="text-xs text-gray-600 mt-1 pl-4 opacity-80">- Creative Editing</p>
              <p className="text-xs text-gray-600 pl-4 opacity-80">- Color Grading</p>
              <p className="text-xs text-gray-600 pl-4 opacity-80">- Sound Design</p>
            </div>
            <span className="font-bold">$$$</span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <span className="font-bold">03. MOTION GRAPHICS</span>
              <p className="text-xs text-gray-600 mt-1 pl-4 opacity-80">- 2D/3D Animation</p>
              <p className="text-xs text-gray-600 pl-4 opacity-80">- Title Design</p>
              <p className="text-xs text-gray-600 pl-4 opacity-80">- Visual Effects</p>
            </div>
            <span className="font-bold">$$$</span>
          </div>

           <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <span className="font-bold">04. STRATEGY</span>
              <p className="text-xs text-gray-600 mt-1 pl-4 opacity-80">- Creative Direction</p>
              <p className="text-xs text-gray-600 pl-4 opacity-80">- Social Optimization</p>
            </div>
            <span className="font-bold">Priceless</span>
          </div>
        </div>

        {/* Footer / Total */}
        <div className="border-t-2 border-black pt-4 mb-8">
           <div className="flex justify-between text-lg font-bold uppercase mb-2">
            <span>Total</span>
            <span>Let's Chat</span>
          </div>
          <div className="text-xs uppercase text-center mt-6 mb-2">
            * Satisfaction Guaranteed<br/>
            * No Hidden Fees<br/>
            * 100% Vibez
          </div>
        </div>

        {/* Barcode (Fake) */}
        <div className="w-full h-12 bg-black/10 flex items-end justify-center gap-1 mb-6 opacity-50">
           {Array.from({ length: 40 }).map((_, i) => (
             <div 
                key={i} 
                className="bg-black" 
                style={{ 
                    width: Math.random() > 0.5 ? '2px' : '4px', 
                    height: Math.random() * 100 + '%',
                    opacity: 1
                }} 
             />
           ))}
        </div>

        {/* CTA Button */}
        <Link href="/#contact" className="block w-full bg-black text-white text-center py-4 font-bold uppercase hover:bg-neutral-800 transition-colors">
            CONTACT US
        </Link>

        {/* Cutout Pattern (Bottom) */}
        <div className="absolute -bottom-2 left-0 w-full h-4 bg-transparent overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle, transparent 50%, white 50%)', backgroundSize: '16px 16px', backgroundPosition: '0 10px' }}></div>
      </div>
      
      {/* Back Button */}
      <Link href="/" className="mt-12 text-xs font-mono uppercase underline hover:no-underline opacity-60 hover:opacity-100 transition-opacity">
        ← Return Home
      </Link>
    </main>
  );
}
