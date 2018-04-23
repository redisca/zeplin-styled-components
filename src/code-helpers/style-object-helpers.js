import {
    isHtmlTag,
    round,
    selectorize,
    blendColors,
    layerHasGradient,
    layerHasBlendMode,
    generateName,
    getColorStringByFormat
} from "../utils";

import {
    NUMERICAL_FONT_BOLD,
    NUMERICAL_FONT_NORMAL
} from "../constants";

function generateShadowStyleObject({
    shadow,
    projectType,
    layerType,
    densityDivisor,
    colorFormat
}) {
    if (layerType === "text") {
        return {
            textShadowColor: getColorStringByFormat(shadow.color, colorFormat),
            textShadowOffset: {
                width: round(shadow.offsetX / densityDivisor, 1),
                height: round(shadow.offsetY / densityDivisor, 1)
            },
            textShadowRadius: round(shadow.blurRadius / densityDivisor, 1)
        };
    }

    if (projectType === "android") {
        return {};
    }

    // "iOS" doesn't have shadow spread
    return {
        shadowColor: getColorStringByFormat(shadow.color, colorFormat),
        shadowOffset: {
            width: round(shadow.offsetX / densityDivisor, 1),
            height: round(shadow.offsetY / densityDivisor, 1)
        },
        shadowRadius: round(shadow.blurRadius / densityDivisor, 1),
        shadowOpacity: 1.0
    };
}

function generateBorderStyleObject(border, layerType, densityDivisor, colorFormat) {
    if (layerType === "text" || (border.fill && border.fill.type === "gradient")) {
        return {};
    }

    return {
        border: `${round(border.thickness / densityDivisor, 1)}px solid ${getColorStringByFormat(border.fill.color, colorFormat)}`,
    };
}

function generateTextLayerStyleObject({
    layer,
    font,
    densityDivisor,
    colorFormat,
    defaultValues,
    layerStyle
}) {
    var styles = generateTextStyleStyleObject({
        textStyle: font,
        densityDivisor,
        colorFormat,
        defaultValues,
        layerStyle
    });

    if (layer.fills && layer.fills.length && !layerHasGradient(layer)) {
        delete styles.color;

        var blendedColor = blendColors(layer.fills.map(fill => fill.color));

        if (font.color) {
            blendedColor = blendedColor.blend(font.color);
        }

        styles.color = getColorStringByFormat(blendedColor, colorFormat);
    }

    return styles;
}
/* eslint-disable complexity */
function generateLayerStyleObject({
    layer,
    projectType,
    densityDivisor,
    showDimensions,
    colorFormat,
    defaultValues
}) {
    var layerType = layer.type;

    var styles = {
        selector: selectorize(layer.name) || ".layer"
    };

    if (showDimensions) {
        styles.width = round(layer.rect.width / densityDivisor, 1) + "px";
        styles.height = round(layer.rect.height / densityDivisor, 1) + "px";
    }

    if (layer.rotation) {
        styles.transform = `rotate(${-layer.rotation}deg)`;
    }

    if (layer.opacity !== 1) {
        var PRECISION = 2;
        styles.opacity = round(layer.opacity, PRECISION);
    }

    if (layer.borderRadius) {
        styles.borderRadius = round(layer.borderRadius / densityDivisor, 1) + "px";
    }

    if (layerType === "text" && layer.defaultTextStyle) {
        var textStyle = generateTextLayerStyleObject({
            layer,
            font: layer.defaultTextStyle,
            densityDivisor,
            colorFormat,
            defaultValues
        });

        delete textStyle.selector;
        Object.assign(styles, textStyle);
    } else if (layer.fills.length && !layerHasGradient(layer) && !layerHasBlendMode(layer)) {
        styles.backgroundColor = getColorStringByFormat(
            blendColors(layer.fills.map(fill => fill.color)),
            colorFormat
        );
    }

    if (layer.shadows.length) {
        // Multiple shadows can only be achieved with multiple views
        Object.assign(styles,
            generateShadowStyleObject({
                shadow: layer.shadows[layer.shadows.length - 1],
                projectType,
                layerType,
                densityDivisor,
                colorFormat
            })
        );
    }

    if (layer.borders.length) {
        Object.assign(styles,
            generateBorderStyleObject(
                layer.borders[layer.borders.length - 1],
                layerType,
                densityDivisor,
                colorFormat
            )
        );
    }

    return styles;
}

function generateTextStyleStyleObject({
    textStyle,
    densityDivisor,
    colorFormat,
    defaultValues,
    layerStyle
}) {
    var selector = selectorize(textStyle.name);
    if (!isHtmlTag(selector)) {
        selector = selector.substring(1);
    }

    var styleProperties = {
        selector
    };
    var overrideLayerStyle;

    styleProperties.fontFamily = textStyle.fontFamily;
    styleProperties.fontSize = round(textStyle.fontSize / densityDivisor, 1) + "px";

    overrideLayerStyle = layerStyle && layerStyle["font-weight"] && layerStyle["font-weight"] !== "normal";
    if (textStyle.fontWeight === NUMERICAL_FONT_BOLD) {
        styleProperties.fontWeight = "bold";
    } else if (textStyle.fontWeight !== NUMERICAL_FONT_NORMAL) {
        styleProperties.fontWeight = String(textStyle.fontWeight);
    } else if (defaultValues || overrideLayerStyle) {
        styleProperties.fontWeight = "normal";
    }

    overrideLayerStyle = layerStyle && layerStyle["font-style"] && layerStyle["font-style"] !== "normal";
    if (textStyle.fontStyle && (textStyle.fontStyle !== "normal" || defaultValues || overrideLayerStyle)) {
        styleProperties.fontStyle = textStyle.fontStyle;
    }

    if (textStyle.lineHeight) {
        styleProperties.lineHeight = round(textStyle.lineHeight / textStyle.fontSize, 2);
    }

    overrideLayerStyle = layerStyle && layerStyle["letter-spacing"] && layerStyle["letter-spacing"] !== "normal";
    if (textStyle.letterSpacing) {
        var PRECISION = 2;
        styleProperties.letterSpacing = round(textStyle.letterSpacing / densityDivisor, PRECISION);
    } else if (defaultValues || overrideLayerStyle) {
        styleProperties.letterSpacing = 0;
    }

    if (textStyle.textAlign) {
        styleProperties.textAlign = textStyle.textAlign;
    }

    if (textStyle.color) {
        styleProperties.color = getColorStringByFormat(textStyle.color, colorFormat);
    }

    return styleProperties;
}

function generateTextStyleCode(textStyle, params) {
    var fontStyles = generateTextStyleStyleObject({
        textStyle,
        densityDivisor: params.densityDivisor,
        colorFormat: params.colorFormat,
        defaultValues: params.defaultValues
    });
    var selector = generateName(fontStyles.selector);
    var textStyleCode = {};

    delete fontStyles.selector;

    if (params.projectColor) {
        fontStyles.color = `\$\{colors.${generateName(params.projectColor.name)}\}`;
    }

    textStyleCode[selector] = fontStyles;

    return textStyleCode;
}

function generateStyleguideTextStylesObject(options, project, textStyles) {
    var params = {
        densityDivisor: project.densityDivisor,
        colorFormat: options.colorFormat,
        defaultValues: options.defaultValues
    };

    return textStyles.reduce((styles, ts) => {
        var tsParams;
        if (ts.color) {
            var projectColor = project.findColorEqual(ts.color);
            tsParams = Object.assign({}, params, { projectColor });
        } else {
            tsParams = params;
        }

        var textStyle = generateTextStyleCode(ts, tsParams);
        return Object.assign(styles, textStyle);
    }, {});
}

export {
    generateTextLayerStyleObject,
    generateLayerStyleObject,
    generateStyleguideTextStylesObject
};