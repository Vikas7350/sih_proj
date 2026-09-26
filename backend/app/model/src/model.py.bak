import re
from pathlib import Path

import torch
import torchvision.models as models
from torchvision.models import EfficientNet_B0_Weights


# ============================================================
# Configuration
# ============================================================

NUM_CLASSES = 5

MODEL_DIR = Path(__file__).resolve().parent.parent

NVIDIA_CHECKPOINT = (
    MODEL_DIR / "nvidia_efficientnet-b0_210412.pth"
)

TRAINED_CHECKPOINT = (
    MODEL_DIR / "checkpoints" / "best_model.pth"
)


# ============================================================
# NVIDIA → torchvision key remapping
#
# NVIDIA EfficientNet naming:
#     stem.conv.weight
#     layers.X.blockY.depsep.conv.weight
#     layers.X.blockY.se.squeeze.weight
#     layers.X.blockY.se.expand.weight
#     layers.X.blockY.proj.conv.weight
#     features.conv.weight
#     classifier.fc.weight
#
# torchvision EfficientNet naming:
#     features.0.0.weight            (stem)
#     features.(X+1).Y.block.Z.*    (MBConv blocks)
#     features.8.0.weight            (final conv)
#     classifier.1.weight            (fc)
# ============================================================

def _map_bn_or_conv(stage, block, sublayer, rest):
    prefix = f'features.{stage}.{block}.block.{sublayer}'
    if rest == 'conv.weight':
        return f'{prefix}.0.weight'
    if rest == 'bn.weight':
        return f'{prefix}.1.weight'
    if rest == 'bn.bias':
        return f'{prefix}.1.bias'
    if rest == 'bn.running_mean':
        return f'{prefix}.1.running_mean'
    if rest == 'bn.running_var':
        return f'{prefix}.1.running_var'
    if rest == 'bn.num_batches_tracked':
        return f'{prefix}.1.num_batches_tracked'
    return None


def remap_nvidia_to_torchvision(nvidia_key):
    """Map a single NVIDIA EfficientNet key to torchvision naming."""

    # ---- stem ---------------------------------------------------
    stem_map = {
        'stem.conv.weight':               'features.0.0.weight',
        'stem.bn.weight':                 'features.0.1.weight',
        'stem.bias':                      'features.0.1.bias',
        'stem.bn.bias':                   'features.0.1.bias',
        'stem.bn.running_mean':           'features.0.1.running_mean',
        'stem.bn.running_var':            'features.0.1.running_var',
        'stem.bn.num_batches_tracked':    'features.0.1.num_batches_tracked',
    }
    if nvidia_key in stem_map:
        return stem_map[nvidia_key]

    # ---- final features (conv + bn) ---------------------------
    feat_map = {
        'features.conv.weight':           'features.8.0.weight',
        'features.bn.weight':             'features.8.1.weight',
        'features.bn.bias':               'features.8.1.bias',
        'features.bn.running_mean':       'features.8.1.running_mean',
        'features.bn.running_var':        'features.8.1.running_var',
        'features.bn.num_batches_tracked':'features.8.1.num_batches_tracked',
    }
    if nvidia_key in feat_map:
        return feat_map[nvidia_key]

    # ---- classifier (skip entirely) ---------------------------
    if nvidia_key.startswith('classifier.'):
        return None

    # ---- MBConv blocks: layers.X.blockY.rest ------------------
    m = re.match(r'layers\.(\d+)\.block(\d+)\.(.*)', nvidia_key)
    if not m:
        return None

    layer_idx = int(m.group(1))
    block_idx = int(m.group(2))
    rest     = m.group(3)
    tv_stage = layer_idx + 1

    if layer_idx == 0:
        # First MBConv — no expansion sublayer
        #   block.0  = depthwise (depsep)
        #   block.1  = SE
        #   block.2  = projection
        if rest.startswith('depsep.'):
            return _map_bn_or_conv(tv_stage, block_idx, 0,
                                   rest[len('depsep.'):])
        if rest.startswith('se.squeeze.'):
            sub = rest[len('se.squeeze.'):]
            return f'features.{tv_stage}.{block_idx}.block.1.fc1.{sub}'
        if rest.startswith('se.expand.'):
            sub = rest[len('se.expand.'):]
            return f'features.{tv_stage}.{block_idx}.block.1.fc2.{sub}'
        if rest.startswith('proj.'):
            return _map_bn_or_conv(tv_stage, block_idx, 2,
                                   rest[len('proj.'):])
    else:
        # MBConv with expansion
        #   block.0  = expansion
        #   block.1  = depthwise (depsep)
        #   block.2  = SE
        #   block.3  = projection
        if rest.startswith('expand.'):
            return _map_bn_or_conv(tv_stage, block_idx, 0,
                                   rest[len('expand.'):])
        if rest.startswith('depsep.'):
            return _map_bn_or_conv(tv_stage, block_idx, 1,
                                   rest[len('depsep.'):])
        if rest.startswith('se.squeeze.'):
            sub = rest[len('se.squeeze.'):]
            return f'features.{tv_stage}.{block_idx}.block.2.fc1.{sub}'
        if rest.startswith('se.expand.'):
            sub = rest[len('se.expand.'):]
            return f'features.{tv_stage}.{block_idx}.block.2.fc2.{sub}'
        if rest.startswith('proj.'):
            return _map_bn_or_conv(tv_stage, block_idx, 3,
                                   rest[len('proj.'):])

    return None


def load_nvidia_checkpoint(model, checkpoint_path):
    """Load an NVIDIA EfficientNet checkpoint into a torchvision model.

    Performs key remapping and SE weight reshaping (2D → 4D).
    """
    ckpt = torch.load(checkpoint_path, map_location='cpu')

    # Handle checkpoints wrapped in a dict with 'model_state_dict'
    if isinstance(ckpt, dict) and 'model_state_dict' in ckpt:
        nvidia_sd = ckpt['model_state_dict']
    else:
        nvidia_sd = ckpt

    tv_sd = model.state_dict()
    remapped = {}

    for nvidia_key, value in nvidia_sd.items():
        tv_key = remap_nvidia_to_torchvision(nvidia_key)
        if tv_key is None:
            continue

        # SE fc layers are Linear in NVIDIA (2D) but Conv2d in torchvision (4D)
        if ('fc1.weight' in tv_key or 'fc2.weight' in tv_key):
            if value.dim() == 2:
                value = value.unsqueeze(-1).unsqueeze(-1)

        remapped[tv_key] = value

    result = model.load_state_dict(remapped, strict=False)

    print(f"  Remapped keys loaded : {len(remapped)}")
    print(f"  Missing keys         : {len(result.missing_keys)} "
          f"(expected classifier head)")
    print(f"  Unexpected keys      : {len(result.unexpected_keys)}")

    expected_missing = {'classifier.1.weight', 'classifier.1.bias'}
    actual_missing = set(result.missing_keys)

    if actual_missing != expected_missing:
        raise RuntimeError(
            "Backbone did NOT load correctly.\n"
            f"Expected missing : {expected_missing}\n"
            f"Actual missing   : {actual_missing}"
        )

    if result.unexpected_keys:
        raise RuntimeError(
            "Unexpected checkpoint keys:\n"
            + "\n".join(f"  {k}" for k in result.unexpected_keys)
        )

    return model


# ============================================================
# Create DR Model
# ============================================================

def create_model(checkpoint_path=None):
    """Create EfficientNet-B0 for 5-class DR classification.

    Parameters
    ----------
    checkpoint_path : Path or str, optional
        Path to a trained DR checkpoint (.pth).
        If None, tries ``model/checkpoints/best_model.pth``
        and falls back to NVIDIA ImageNet pretrained weights.

    Returns
    -------
    torch.nn.Module
        EfficientNet-B0 with a 5-class classifier head.
    """

    # --------------------------------------------------------
    # Build model with torchvision EfficientNet-B0
    # --------------------------------------------------------

    model = models.efficientnet_b0(
        weights=None,
    )

    # Replace classifier head for 5 DR classes
    in_features = model.classifier[1].in_features   # 1280
    model.classifier[1] = torch.nn.Linear(
        in_features, NUM_CLASSES
    )

    print("EfficientNet-B0 (torchvision) created with 5 classes.")

    # --------------------------------------------------------
    # Load checkpoint
    # --------------------------------------------------------

    if checkpoint_path is None:
        checkpoint_path = TRAINED_CHECKPOINT

    checkpoint_path = Path(checkpoint_path)

    if not checkpoint_path.exists():
        raise FileNotFoundError(
            f"Checkpoint not found: {checkpoint_path}"
        )

    # Check if this is a trained DR checkpoint (has model_state_dict)
    ckpt = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
    is_trained = (
        isinstance(ckpt, dict) and 'model_state_dict' in ckpt
    )

    if is_trained:
        # Trained DR checkpoint — remap NVIDIA keys into torchvision
        print(f"Loading trained DR checkpoint: {checkpoint_path}")
        load_nvidia_checkpoint(model, checkpoint_path)

        epoch    = ckpt.get('epoch', '?')
        f1       = ckpt.get('best_macro_f1', '?')
        classes  = ckpt.get('class_names', None)
        print(f"  Epoch        : {epoch}")
        print(f"  Best macro F1: {f1}")
        if classes:
            print(f"  Classes      : {classes}")
    else:
        # Raw NVIDIA ImageNet checkpoint
        print(f"Loading NVIDIA pretrained checkpoint: {checkpoint_path}")
        load_nvidia_checkpoint(model, checkpoint_path)

    # --------------------------------------------------------
    # Done
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("MODEL LOADED SUCCESSFULLY")
    print("=" * 60)
    print(f"  Backbone  : EfficientNet-B0 (torchvision)")
    print(f"  Classifier: {NUM_CLASSES}-class DR head")
    print(f"  Classes   : No DR, Mild, Moderate, Severe, Proliferative")
    print()

    return model


# ============================================================
# CLI: quick sanity check
# ============================================================

if __name__ == '__main__':
    model = create_model()
    x = torch.randn(1, 3, 224, 224)
    with torch.no_grad():
        out = model(x)
    print(f"Dummy output shape: {out.shape}")
    print(f"Predicted class   : {out.argmax(dim=1).item()}")
