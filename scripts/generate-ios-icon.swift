import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: generate-ios-icon.swift <logo.png> <AppIcon.appiconset>")
}

let source = CommandLine.arguments[1]
let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
guard let logo = NSImage(contentsOfFile: source),
      let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024,
        bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false,
        isPlanar: false, colorSpaceName: .deviceRGB,
        bytesPerRow: 0, bitsPerPixel: 0
      ),
      let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("Unable to load the APTRANSP logo or create the iOS icon")
}

// Use the application's existing theme as the opaque iOS icon background.
let manifest = try Data(contentsOf: URL(fileURLWithPath: "public/manifest.json"))
guard let config = try JSONSerialization.jsonObject(with: manifest) as? [String: Any],
      let theme = config["theme_color"] as? String,
      let rgb = UInt32(theme.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) else {
    fatalError("The application manifest must specify a theme color")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSColor(
    calibratedRed: CGFloat((rgb >> 16) & 255) / 255,
    green: CGFloat((rgb >> 8) & 255) / 255,
    blue: CGFloat(rgb & 255) / 255,
    alpha: 1
).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: 1024, height: 1024)).fill()
context.imageInterpolation = .high
logo.draw(in: NSRect(x: 0, y: 0, width: 1024, height: 1024))
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to encode the iOS icon")
}
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
try png.write(to: output.appendingPathComponent("AppIcon-1024.png"))
let contents: [String: Any] = [
    "images": [["filename": "AppIcon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"]],
    "info": ["author": "xcode", "version": 1]
]
try JSONSerialization.data(withJSONObject: contents, options: [.prettyPrinted, .sortedKeys])
    .write(to: output.appendingPathComponent("Contents.json"))

let generatedIconData = try Data(contentsOf: output.appendingPathComponent("AppIcon-1024.png"))
guard let result = NSBitmapImageRep(data: generatedIconData),
      result.pixelsWide == 1024, result.pixelsHigh == 1024, !result.hasAlpha else {
    fatalError("iOS requires an opaque 1024x1024 app icon")
}
print("APTRANSP iOS icon generated and validated: 1024x1024, no alpha")